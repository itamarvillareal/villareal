package br.com.vilareal.assinatura.keystore;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.Provider;
import java.security.Security;
import java.util.Arrays;
import java.util.Objects;

/**
 * Acesso PKCS#11 (token A3 SafeSign/Soluti) com <strong>sessão por lote</strong>:
 * {@link #open()} faz login uma vez; {@link #load()} reutiliza a sessão para vários PDFs;
 * {@link #close()} faz logout e libera o token para outros programas (ex.: sai.jar).
 */
public final class Pkcs11KeyMaterialProvider implements AssinaturaKeyMaterialProvider {

    private final Path pkcs11ConfigPath;
    private final char[] tokenPin;
    private final String signerCertThumbprintSha1;

    private Provider pkcs11Provider;
    private KeyStore keyStore;
    private String signerAlias;
    private boolean open;
    private boolean closed;

    public Pkcs11KeyMaterialProvider(Path pkcs11ConfigPath, char[] tokenPin) {
        this(pkcs11ConfigPath, tokenPin, AssinaturaTokenConstantes.SIGNER_THUMBPRINT_SHA1);
    }

    public Pkcs11KeyMaterialProvider(
            Path pkcs11ConfigPath, char[] tokenPin, String signerCertThumbprintSha1) {
        if (pkcs11ConfigPath == null) {
            throw new IllegalArgumentException("pkcs11ConfigPath é obrigatório");
        }
        if (!Files.isRegularFile(pkcs11ConfigPath)) {
            throw new IllegalArgumentException("arquivo PKCS#11 .cfg não encontrado: " + pkcs11ConfigPath);
        }
        if (tokenPin == null || tokenPin.length == 0) {
            throw new IllegalArgumentException(
                    "PIN do token é obrigatório (env " + AssinaturaTokenConstantes.ENV_TOKEN_PIN + ")");
        }
        this.pkcs11ConfigPath = pkcs11ConfigPath;
        this.tokenPin = tokenPin.clone();
        this.signerCertThumbprintSha1 = Objects.requireNonNullElse(
                signerCertThumbprintSha1, AssinaturaTokenConstantes.SIGNER_THUMBPRINT_SHA1);
    }

    /** Cria provider a partir do .cfg padrão no classpath (Windows) e PIN em variável de ambiente. */
    public static Pkcs11KeyMaterialProvider fromEnvironment() throws Exception {
        String pinEnv = System.getenv(AssinaturaTokenConstantes.ENV_TOKEN_PIN);
        if (pinEnv == null || pinEnv.isBlank()) {
            throw new IllegalStateException(
                    "defina " + AssinaturaTokenConstantes.ENV_TOKEN_PIN + " para abrir o token PKCS#11");
        }
        Path cfg = resolverCfgPath();
        return new Pkcs11KeyMaterialProvider(cfg, pinEnv.toCharArray());
    }

    public static Path resolverCfgPath() throws Exception {
        String cfgEnv = System.getenv(AssinaturaTokenConstantes.ENV_PKCS11_CFG);
        if (cfgEnv != null && !cfgEnv.isBlank()) {
            return Path.of(cfgEnv.trim());
        }
        int slot = resolverSlotListIndex();
        return Pkcs11ProviderFactory.materializarCfgClasspath(
                AssinaturaTokenConstantes.PKCS11_CFG_CLASSPATH, slot);
    }

    public static int resolverSlotListIndex() {
        String slotEnv = System.getenv(AssinaturaTokenConstantes.ENV_PKCS11_SLOT_INDEX);
        if (slotEnv == null || slotEnv.isBlank()) {
            return AssinaturaTokenConstantes.DEFAULT_PKCS11_SLOT_INDEX;
        }
        return Integer.parseInt(slotEnv.trim());
    }

    /**
     * Abre sessão no token (login PKCS#11). Chamar uma vez por lote antes de assinar.
     *
     * @throws Pkcs11TokenException se o token estiver ocupado, ausente ou o PIN for inválido
     */
    public synchronized void open() throws Pkcs11TokenException {
        garantirNaoFechado();
        if (open) {
            return;
        }
        try {
            pkcs11Provider = Pkcs11ProviderFactory.criar(pkcs11ConfigPath);
            if (Security.getProvider(pkcs11Provider.getName()) == null) {
                Security.addProvider(pkcs11Provider);
            }
            keyStore = KeyStore.getInstance("PKCS11", pkcs11Provider);
            keyStore.load(null, tokenPin);
            signerAlias =
                    CertificadoSelecaoUtil.resolverAliasPorThumbprintSha1(keyStore, signerCertThumbprintSha1);
            open = true;
        } catch (Pkcs11TokenException e) {
            liberarRecursosSemLogout();
            throw e;
        } catch (Exception e) {
            liberarRecursosSemLogout();
            throw Pkcs11TokenErroUtil.classificar(e);
        }
    }

    @Override
    public AssinaturaKeyMaterial load() throws Exception {
        garantirSessaoAberta();
        return CertificadoSelecaoUtil.carregarMaterial(keyStore, signerAlias, tokenPin, pkcs11Provider);
    }

    @Override
    public Provider signingProvider() {
        garantirSessaoAbertaSemChecked();
        return pkcs11Provider;
    }

    /** Indica se há sessão PKCS#11 ativa (entre {@link #open()} e {@link #close()}). */
    public boolean isOpen() {
        return open && !closed;
    }

    public String signerAlias() {
        return signerAlias;
    }

    /**
     * Encerra a sessão PKCS#11 (logout) e remove o provider, liberando o token.
     * Após {@code close()}, esta instância não pode ser reaberta — crie outra para o próximo lote.
     */
    @Override
    public synchronized void close() {
        if (closed) {
            return;
        }
        logoutSessao();
        liberarRecursosSemLogout();
        Arrays.fill(tokenPin, '\0');
        closed = true;
    }

    private void logoutSessao() {
        if (keyStore == null) {
            return;
        }
        try {
            keyStore.load(null, null);
        } catch (Exception ignored) {
            // best-effort — remover o provider também encerra sessões SunPKCS11
        }
    }

    private void liberarRecursosSemLogout() {
        if (pkcs11Provider != null) {
            try {
                Security.removeProvider(pkcs11Provider.getName());
            } catch (Exception ignored) {
                // best-effort
            }
        }
        pkcs11Provider = null;
        keyStore = null;
        signerAlias = null;
        open = false;
    }

    private void garantirNaoFechado() {
        if (closed) {
            throw new IllegalStateException(
                    "Pkcs11KeyMaterialProvider já foi fechado — crie nova instância para o próximo lote");
        }
    }

    private void garantirSessaoAberta() throws Pkcs11TokenException {
        garantirNaoFechado();
        if (!open) {
            throw new IllegalStateException(
                    "Chame open() antes de load() — sessão PKCS#11 por lote (um login, várias assinaturas, depois close())");
        }
    }

    private void garantirSessaoAbertaSemChecked() {
        try {
            garantirSessaoAberta();
        } catch (Pkcs11TokenException e) {
            throw new IllegalStateException(e.getMessage(), e);
        }
    }
}
