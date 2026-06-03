package br.com.vilareal.jobrun.api.dto;

import java.time.Instant;

public record JobHealthItemResponse(
        String jobName,
        String displayName,
        String health,
        String healthDetail,
        String lastStatus,
        Instant lastStartedAt,
        Instant lastFinishedAt,
        Long lastDurationMs,
        Integer lastItemsProcessed,
        Integer lastItemsFailed,
        int expectedIntervalMinutes,
        int maxRunningMinutes,
        Instant nextExpectedAt,
        boolean runningNow) {}
