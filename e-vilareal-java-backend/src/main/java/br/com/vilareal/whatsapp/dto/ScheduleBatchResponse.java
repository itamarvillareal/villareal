package br.com.vilareal.whatsapp.dto;

import java.time.Instant;
import java.util.List;

public record ScheduleBatchResponse(
        int criados,
        int pulados,
        int totalSolicitado,
        List<Long> ids,
        List<Instant> scheduledAt,
        String message) {}
