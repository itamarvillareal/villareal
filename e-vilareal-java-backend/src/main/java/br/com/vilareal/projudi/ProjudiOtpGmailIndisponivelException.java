package br.com.vilareal.projudi;

/**
 * Gmail não configurado ou bean {@code gmail} ausente — impossível ler OTP do PROJUDI.
 * Distinto de timeout de OTP ({@code Token OTP não recebido no prazo}).
 */
public class ProjudiOtpGmailIndisponivelException extends RuntimeException {

    public static final String MENSAGEM =
            "Gmail indisponível: não foi possível ler o OTP do PROJUDI";

    public ProjudiOtpGmailIndisponivelException() {
        super(MENSAGEM);
    }

    public ProjudiOtpGmailIndisponivelException(String detalhe) {
        super(detalhe != null && !detalhe.isBlank() ? MENSAGEM + " (" + detalhe + ")" : MENSAGEM);
    }
}
