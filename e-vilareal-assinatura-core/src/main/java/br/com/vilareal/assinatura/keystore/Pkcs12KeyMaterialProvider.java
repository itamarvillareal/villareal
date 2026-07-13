package br.com.vilareal.assinatura.keystore;

import java.nio.file.Path;
import java.security.KeyStore;
import java.security.Provider;
import java.security.Security;

import org.bouncycastle.jce.provider.BouncyCastleProvider;

/**
 * Carrega chave privada e certificado do signatário a partir de arquivo .pfx/.p12 (A1).
 * Senha e caminho vêm de configuração/env — nunca hardcoded em produção.
 */
public final class Pkcs12KeyMaterialProvider implements AssinaturaKeyMaterialProvider {

    private static final Provider SIGNING_PROVIDER = registrarBouncyCastleSeNecessario();

    private final Path keystorePath;
    private final char[] keystorePassword;
    private final String signerCertThumbprintSha1;

    public Pkcs12KeyMaterialProvider(Path keystorePath, char[] keystorePassword) {
        this(keystorePath, keystorePassword, null);
    }

    public Pkcs12KeyMaterialProvider(
            Path keystorePath, char[] keystorePassword, String signerCertThumbprintSha1) {
        if (keystorePath == null) {
            throw new IllegalArgumentException("keystorePath é obrigatório");
        }
        this.keystorePath = keystorePath;
        this.keystorePassword = keystorePassword != null ? keystorePassword : new char[0];
        // Sem thumbprint explícito: honra o env, mas NÃO herda o default do token de hardware —
        // um .p12/.pfx A1 raramente contém o certificado do token e tem chave única, resolvida
        // por CertificadoSelecaoUtil.resolverUnicoAliasChave.
        this.signerCertThumbprintSha1 = signerCertThumbprintSha1 == null
                ? AssinaturaTokenConstantes.resolverSignerThumbprintSha1SemDefault()
                : AssinaturaTokenConstantes.normalizarThumbprintSha1(signerCertThumbprintSha1);
    }

    @Override
    public AssinaturaKeyMaterial load() throws Exception {
        KeyStore keyStore = CertificadoSelecaoUtil.carregarPkcs12(keystorePath, keystorePassword);
        String alias =
                CertificadoSelecaoUtil.resolverAliasPorThumbprintSha1(keyStore, signerCertThumbprintSha1);
        return CertificadoSelecaoUtil.carregarMaterial(keyStore, alias, keystorePassword, SIGNING_PROVIDER);
    }

    @Override
    public Provider signingProvider() {
        return SIGNING_PROVIDER;
    }

    @Override
    public void close() {
        // PKCS12 em arquivo não mantém sessão — nada a fechar
    }

    private static Provider registrarBouncyCastleSeNecessario() {
        Provider provider = Security.getProvider(BouncyCastleProvider.PROVIDER_NAME);
        if (provider == null) {
            provider = new BouncyCastleProvider();
            Security.addProvider(provider);
        }
        return provider;
    }
}
