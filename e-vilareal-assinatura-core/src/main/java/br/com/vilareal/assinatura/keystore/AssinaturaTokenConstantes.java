package br.com.vilareal.assinatura.keystore;

import java.util.Locale;

/**
 * Constantes do token Soluti/SafeSign usado em produção e nos testes de hardware Windows.
 */
public final class AssinaturaTokenConstantes {

    /** e-CPF Soluti Videoconferência — seleção obrigatória por thumbprint (não por CN). */
    public static final String SIGNER_THUMBPRINT_SHA1 = "C695BA1EC72328487E8FCDC4C34357FEFDD3D100";

    public static final String ENV_TOKEN_PIN = "ASSINATURA_TOKEN_PIN";
    public static final String ENV_PKCS11_CFG = "ASSINATURA_PKCS11_CFG";
    public static final String ENV_PKCS11_SLOT_INDEX = "ASSINATURA_PKCS11_SLOT_INDEX";
    /** Thumbprint SHA-1 do certificado no token; se ausente, usa {@link #SIGNER_THUMBPRINT_SHA1}. */
    public static final String ENV_SIGNER_THUMBPRINT = "ASSINATURA_SIGNER_THUMBPRINT";

    /** Default do slot SafeSign nesta máquina; sobrescrevível via {@link #ENV_PKCS11_SLOT_INDEX}. */
    public static final int DEFAULT_PKCS11_SLOT_INDEX = 3;

    public static final String PKCS11_CFG_CLASSPATH = "pkcs11/pkcs11-soluti.cfg";

    private AssinaturaTokenConstantes() {}

    /** Lê {@link #ENV_SIGNER_THUMBPRINT} ou retorna o thumbprint padrão do token G+D/SafeSign. */
    public static String resolverSignerThumbprintSha1() {
        String env = System.getenv(ENV_SIGNER_THUMBPRINT);
        if (env != null && !env.isBlank()) {
            return normalizarThumbprintSha1(env);
        }
        return SIGNER_THUMBPRINT_SHA1;
    }

    /** Remove espaços e normaliza para maiúsculas (comparação case-insensitive). */
    public static String normalizarThumbprintSha1(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        return raw.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
    }
}
