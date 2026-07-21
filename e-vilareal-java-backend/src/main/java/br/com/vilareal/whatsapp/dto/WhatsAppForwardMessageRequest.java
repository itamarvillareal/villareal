package br.com.vilareal.whatsapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/** Corpo de {@code POST /api/whatsapp/messages/{id}/forward}. */
public record WhatsAppForwardMessageRequest(
        @NotEmpty List<@NotBlank String> phoneNumbers,
        /** Legenda opcional para mídia; se ausente, reutiliza a da mensagem original. */
        String caption) {}
