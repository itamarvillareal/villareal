package br.com.vilareal.whatsapp.dto;

import java.time.Instant;

public record WhatsAppMessageDTO(
        Long id,
        String waMessageId,
        String phoneNumber,
        String contactName,
        String direction,
        String messageType,
        String content,
        String templateName,
        String status,
        Long clienteId,
        Long processoId,
        String mediaId,
        String mediaMimeType,
        String mediaFilename,
        String mediaDriveUrl,
        Instant createdAt) {}
