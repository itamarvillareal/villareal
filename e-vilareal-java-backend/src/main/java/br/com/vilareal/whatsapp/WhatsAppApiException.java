package br.com.vilareal.whatsapp;

/**
 * Erro retornado pela WhatsApp Cloud API (Meta Graph) ou falha de comunicação HTTP.
 */
public class WhatsAppApiException extends RuntimeException {

    private final int httpStatusCode;
    private final String errorType;
    private final int metaErrorCode;

    public WhatsAppApiException(String message, int httpStatusCode, String errorType, int metaErrorCode) {
        super(message);
        this.httpStatusCode = httpStatusCode;
        this.errorType = errorType;
        this.metaErrorCode = metaErrorCode;
    }

    public WhatsAppApiException(
            String message, int httpStatusCode, String errorType, int metaErrorCode, Throwable cause) {
        super(message, cause);
        this.httpStatusCode = httpStatusCode;
        this.errorType = errorType;
        this.metaErrorCode = metaErrorCode;
    }

    public int getHttpStatusCode() {
        return httpStatusCode;
    }

    public String getErrorType() {
        return errorType;
    }

    public int getMetaErrorCode() {
        return metaErrorCode;
    }
}
