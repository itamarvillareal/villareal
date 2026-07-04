package br.com.vilareal.whatsapp.dto;

import java.time.Instant;
import java.util.List;

public record ScheduleBatchPreviewResponse(int total, List<Instant> scheduledAt, List<String> labels) {}
