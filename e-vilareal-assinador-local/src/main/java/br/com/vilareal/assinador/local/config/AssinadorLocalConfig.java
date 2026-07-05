package br.com.vilareal.assinador.local.config;

import br.com.vilareal.assinatura.keystore.AssinaturaTokenConstantes;

import java.net.URI;
import java.util.Arrays;

/**
 * Configuração via variáveis de ambiente (nunca logar PIN nem segredo).
 */
public final class AssinadorLocalConfig {

    public static final String ENV_API_URL = "ASSINADOR_API_URL";
    public static final String ENV_API_SECRET = "ASSINADOR_API_SECRET";
    public static final String ENV_ASSINADOR_ID = "ASSINADOR_ID";

    private static final int LONG_POLL_TIMEOUT_SEGUNDOS = 55;
    private static final long BACKOFF_INICIAL_MS = 2_000L;
    private static final long BACKOFF_MAX_MS = 60_000L;

    private final URI apiBaseUri;
    private final String apiSecret;
    private final String assinadorId;
    private final char[] tokenPin;
    private final int pkcs11SlotIndex;
    private final long backoffInicialMs;
    private final long backoffMaxMs;
    private final int longPollTimeoutSegundos;

    public AssinadorLocalConfig(
            URI apiBaseUri,
            String apiSecret,
            String assinadorId,
            char[] tokenPin,
            int pkcs11SlotIndex,
            long backoffInicialMs,
            long backoffMaxMs,
            int longPollTimeoutSegundos) {
        this.apiBaseUri = apiBaseUri;
        this.apiSecret = apiSecret;
        this.assinadorId = assinadorId;
        this.tokenPin = tokenPin.clone();
        this.pkcs11SlotIndex = pkcs11SlotIndex;
        this.backoffInicialMs = backoffInicialMs;
        this.backoffMaxMs = backoffMaxMs;
        this.longPollTimeoutSegundos = longPollTimeoutSegundos;
    }

    public static AssinadorLocalConfig fromEnvironment() {
        String apiUrl = exigirEnv(ENV_API_URL);
        String secret = exigirEnv(ENV_API_SECRET);
        String assinadorId = exigirEnv(ENV_ASSINADOR_ID);
        String pin = exigirEnv(AssinaturaTokenConstantes.ENV_TOKEN_PIN);

        URI base = URI.create(normalizarBaseUrl(apiUrl));
        int slot = resolverSlot();

        return new AssinadorLocalConfig(
                base,
                secret.trim(),
                assinadorId.trim(),
                pin.toCharArray(),
                slot,
                BACKOFF_INICIAL_MS,
                BACKOFF_MAX_MS,
                LONG_POLL_TIMEOUT_SEGUNDOS);
    }

    /** Para testes — não usar em produção. */
    public static AssinadorLocalConfig paraTeste(
            URI apiBaseUri, String apiSecret, String assinadorId, char[] tokenPin) {
        return new AssinadorLocalConfig(
                apiBaseUri, apiSecret, assinadorId, tokenPin, AssinaturaTokenConstantes.DEFAULT_PKCS11_SLOT_INDEX,
                10L, 100L, 2);
    }

    public URI apiBaseUri() {
        return apiBaseUri;
    }

    public String apiSecret() {
        return apiSecret;
    }

    public String assinadorId() {
        return assinadorId;
    }

    /** Cópia do PIN — nova instância PKCS#11 por lote. */
    public char[] tokenPinClone() {
        return tokenPin.clone();
    }

    public int pkcs11SlotIndex() {
        return pkcs11SlotIndex;
    }

    public long backoffInicialMs() {
        return backoffInicialMs;
    }

    public long backoffMaxMs() {
        return backoffMaxMs;
    }

    public int longPollTimeoutSegundos() {
        return longPollTimeoutSegundos;
    }

    public String apiPrefix() {
        String base = apiBaseUri.toString();
        if (base.endsWith("/")) {
            return base + "api/assinador/v1";
        }
        return base + "/api/assinador/v1";
    }

    public void zerarPin() {
        Arrays.fill(tokenPin, '\0');
    }

    private static String exigirEnv(String nome) {
        String valor = System.getenv(nome);
        if (valor == null || valor.isBlank()) {
            throw new IllegalStateException("Variável de ambiente obrigatória: " + nome);
        }
        return valor;
    }

    private static String normalizarBaseUrl(String url) {
        String trimmed = url.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private static int resolverSlot() {
        String slotEnv = System.getenv(AssinaturaTokenConstantes.ENV_PKCS11_SLOT_INDEX);
        if (slotEnv == null || slotEnv.isBlank()) {
            return AssinaturaTokenConstantes.DEFAULT_PKCS11_SLOT_INDEX;
        }
        return Integer.parseInt(slotEnv.trim());
    }
}
