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
        /** Datas avulsas (ISO UTC). Ignorado se houver recorrência. */
        List<Instant> scheduledAtList,
        /** Recorrência unificada (mensal, semanal, intervalo no dia). */
        RecorrenciaAgendamentoRequest recorrencia,
        /** Legado — preferir {@link #recorrencia()} com tipo MENSAL. */
        RecorrenciaMensalRequest recorrenciaMensal) {}
