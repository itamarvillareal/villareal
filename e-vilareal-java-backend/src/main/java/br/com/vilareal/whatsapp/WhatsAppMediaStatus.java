package br.com.vilareal.whatsapp;

/**
 * Status do download/upload de mídia inbound (Meta → Google Drive).
 * Distinto de {@link WhatsAppMessageStatus} (ciclo de vida da mensagem na Meta).
 */
public enum WhatsAppMediaStatus {
    PENDING,
    DONE,
    FAILED
}
