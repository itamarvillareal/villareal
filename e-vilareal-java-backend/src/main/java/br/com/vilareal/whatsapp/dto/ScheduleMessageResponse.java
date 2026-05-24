package br.com.vilareal.whatsapp.dto;

import java.time.Instant;

public record ScheduleMessageResponse(boolean success, Long scheduledId, Instant scheduledAt, String error) {}
