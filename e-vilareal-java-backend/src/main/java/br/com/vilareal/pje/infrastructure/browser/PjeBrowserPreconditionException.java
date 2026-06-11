package br.com.vilareal.pje.infrastructure.browser;

/**
 * Falha acionável antes/durante o 2FA (enrollment, gov.br, etc.).
 */
public class PjeBrowserPreconditionException extends RuntimeException {

    public static final String MSG_ENROLLMENT =
            "Conta sem app autenticador configurado ou MFA redefinido — refazer enrollment e recadastrar o secret PJE_TRT18";

    public static final String MSG_SOMENTE_GOVBR =
            "Conta configurada apenas com gov.br — não há segredo TOTP extraível; configure app autenticador no PJe.";

    public PjeBrowserPreconditionException(String message) {
        super(message);
    }
}
