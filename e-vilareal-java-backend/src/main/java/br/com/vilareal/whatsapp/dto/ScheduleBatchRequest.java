package br.com.vilareal.whatsapp.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

public record ScheduleBatchRequest(
        @NotBlank String phoneNumber,
        @NotBlank String templateName,
        List<String> parameters,
        Long clienteId,
        Long processoId,
        String descricao,
        /** Datas avulsas (ISO UTC). Ignorado se {@code recorrenciaMensal} estiver preenchido. */
        List<Instant> scheduledAtList,
        /** Recorrência mensal — datas geradas no backend (Brasília). */
        RecorrenciaMensalRequest recorrenciaMensal) {}
