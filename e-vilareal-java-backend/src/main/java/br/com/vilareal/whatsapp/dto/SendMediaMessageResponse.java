package br.com.vilareal.whatsapp.dto;

/**
 * Resposta do envio outbound de mídia ({@code POST /api/whatsapp/send-media}).
 */
public record SendMediaMessageResponse(
        boolean success,
        Long messageId,
        String waMessageId,
        String mediaStatus,
        String error) {}
