package br.com.vilareal.whatsapp.dto;

import java.time.Instant;
import java.util.List;

public record ScheduledMessageDTO(
        Long id,
        String phoneNumber,
        String templateName,
        List<String> templateParams,
        Instant scheduledAt,
        String status,
        Instant sentAt,
        String errorMessage,
        int retryCount,
        Long clienteId,
        Long processoId,
        String createdBy,
        String descricao,
        Instant createdAt,
        /** MESSAGE (padrão) ou COBRANCA — define qual API usar ao cancelar. */
        String source) {

    public ScheduledMessageDTO(
            Long id,
            String phoneNumber,
            String templateName,
            List<String> templateParams,
            Instant scheduledAt,
            String status,
            Instant sentAt,
            String errorMessage,
            int retryCount,
            Long clienteId,
            Long processoId,
            String createdBy,
            String descricao,
            Instant createdAt) {
        this(
                id,
                phoneNumber,
                templateName,
                templateParams,
                scheduledAt,
                status,
                sentAt,
                errorMessage,
                retryCount,
                clienteId,
                processoId,
                createdBy,
                descricao,
                createdAt,
                "MESSAGE");
    }
}
