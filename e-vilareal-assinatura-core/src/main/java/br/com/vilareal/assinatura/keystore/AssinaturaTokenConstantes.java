package br.com.vilareal.assinatura.keystore;

/**
 * Constantes do token Soluti/SafeSign usado em produção e nos testes de hardware Windows.
 */
public final class AssinaturaTokenConstantes {

    /** e-CPF Soluti Videoconferência — seleção obrigatória por thumbprint (não por CN). */
    public static final String SIGNER_THUMBPRINT_SHA1 = "C695BA1EC72328487E8FCDC4C34357FEFDD3D100";

    public static final String ENV_TOKEN_PIN = "ASSINATURA_TOKEN_PIN";
    public static final String ENV_PKCS11_CFG = "ASSINATURA_PKCS11_CFG";
    public static final String ENV_PKCS11_SLOT_INDEX = "ASSINATURA_PKCS11_SLOT_INDEX";

    /** Default do slot SafeSign nesta máquina; sobrescrevível via {@link #ENV_PKCS11_SLOT_INDEX}. */
    public static final int DEFAULT_PKCS11_SLOT_INDEX = 3;

    public static final String PKCS11_CFG_CLASSPATH = "pkcs11/pkcs11-soluti.cfg";

    private AssinaturaTokenConstantes() {}
}
