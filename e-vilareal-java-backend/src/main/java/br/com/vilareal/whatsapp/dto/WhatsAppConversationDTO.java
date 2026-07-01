package br.com.vilareal.whatsapp.dto;

import java.time.Instant;
import java.util.List;

public record WhatsAppConversationDTO(
        String phoneNumber,
        String contactName,
        String lastMessagePreview,
        String lastMessageDirection,
        String lastMessageType,
        Instant lastMessageAt,
        WhatsAppProcessoContextItemDTO contextoPrincipal,
        List<WhatsAppProcessoContextItemDTO> contextos) {}
