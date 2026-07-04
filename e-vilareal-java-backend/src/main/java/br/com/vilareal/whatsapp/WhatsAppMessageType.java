package br.com.vilareal.whatsapp;

/**
 * Tipo de conteúdo de mensagem WhatsApp (texto, mídia, template, etc.).
 */
public enum WhatsAppMessageType {
    TEXT,
    TEMPLATE,
    IMAGE,
    DOCUMENT,
    AUDIO,
    VIDEO,
    CONTACT,
    LOCATION,
    INTERACTIVE,
    BUTTON,
    UNKNOWN
}
