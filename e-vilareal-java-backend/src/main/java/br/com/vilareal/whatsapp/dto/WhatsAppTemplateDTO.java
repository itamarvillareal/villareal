package br.com.vilareal.whatsapp.dto;

import java.util.List;

/**
 * Template de mensagem WhatsApp (Meta Business).
 */
public record WhatsAppTemplateDTO(
        String id,
        String name,
        String status,
        String category,
        String language,
        String bodyText,
        List<String> exampleValues,
        int parameterCount) {}
