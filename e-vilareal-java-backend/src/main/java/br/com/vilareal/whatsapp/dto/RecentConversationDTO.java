package br.com.vilareal.whatsapp.dto;

import java.time.Instant;

public record RecentConversationDTO(
        String phoneNumber,
        String phoneNumberFormatted,
        String contactName,
        String lastMessageContent,
        String lastMessageType,
        Instant lastMessageAt,
        long totalMessages) {}
