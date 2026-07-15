package br.com.vilareal.whatsapp.dto;

/** Resultado do encaminhamento para um destinatário. */
public record WhatsAppForwardDestinationResult(
        String phoneNumber, boolean success, Long messageId, String waMessageId, String error) {}
