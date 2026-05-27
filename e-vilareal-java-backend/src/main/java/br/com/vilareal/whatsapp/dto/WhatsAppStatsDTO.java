package br.com.vilareal.whatsapp.dto;

import java.time.Instant;

public record WhatsAppStatsDTO(
        long sentToday,
        long receivedToday,
        long scheduledPending,
        long failedToday,
        boolean integrationConfigured,
        Instant fetchedAt) {}
