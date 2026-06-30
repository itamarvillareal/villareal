package br.com.vilareal.whatsapp.dto;

import java.time.Instant;

public record WhatsAppConversationDTO(
        String phoneNumber,
        String contactName,
        String lastMessagePreview,
        String lastMessageDirection,
        String lastMessageType,
        Instant lastMessageAt) {}
