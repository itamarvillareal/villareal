package br.com.vilareal.whatsapp.dto;

import java.time.Instant;

public record WhatsAppNotificationDTO(
        Long messageId,
        String phoneNumber,
        String phoneNumberFormatted,
        String contactName,
        String content,
        String messageType,
        String direction,
        Instant createdAt) {}
