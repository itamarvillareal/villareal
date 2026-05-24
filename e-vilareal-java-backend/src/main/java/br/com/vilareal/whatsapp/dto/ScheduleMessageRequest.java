package br.com.vilareal.whatsapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;

public record ScheduleMessageRequest(
        @NotBlank String phoneNumber,
        @NotBlank String templateName,
        List<String> parameters,
        @NotNull Instant scheduledAt,
        Long clienteId,
        Long processoId,
        String descricao) {}
