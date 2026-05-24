package br.com.vilareal.whatsapp;

/**
 * Status de ciclo de vida de uma mensagem WhatsApp.
 */
public enum WhatsAppMessageStatus {
    PENDING,
    SENT,
    DELIVERED,
    READ,
    FAILED,
    RECEIVED
}
