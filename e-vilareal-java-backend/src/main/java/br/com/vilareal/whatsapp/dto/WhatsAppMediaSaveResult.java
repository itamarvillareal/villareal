package br.com.vilareal.whatsapp.dto;

/**
 * Resultado do upload de mídia WhatsApp recebida para o Google Drive.
 */
public record WhatsAppMediaSaveResult(String webViewLink, String fileId) {}
