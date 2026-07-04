package br.com.vilareal.whatsapp;

/**
 * Categoria de mídia outbound/inbound aceita pela Meta (image, document, audio, video).
 * Corresponde a {@link WhatsAppMessageType} IMAGE/DOCUMENT/AUDIO/VIDEO.
 */
public enum WhatsAppMediaCategory {
    IMAGE,
    DOCUMENT,
    AUDIO,
    VIDEO;

    public WhatsAppMessageType toMessageType() {
        return switch (this) {
            case IMAGE -> WhatsAppMessageType.IMAGE;
            case DOCUMENT -> WhatsAppMessageType.DOCUMENT;
            case AUDIO -> WhatsAppMessageType.AUDIO;
            case VIDEO -> WhatsAppMessageType.VIDEO;
        };
    }

    /** Valor do campo {@code type} no POST /messages da Meta. */
    public String metaMessageType() {
        return name().toLowerCase();
    }
}
