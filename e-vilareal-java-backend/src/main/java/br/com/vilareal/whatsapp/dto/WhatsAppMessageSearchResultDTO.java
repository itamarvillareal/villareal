package br.com.vilareal.whatsapp.dto;

import java.util.List;

public record WhatsAppMessageSearchResultDTO(
        int total, List<Long> messageIds, List<WhatsAppMessageDTO> matches) {}
