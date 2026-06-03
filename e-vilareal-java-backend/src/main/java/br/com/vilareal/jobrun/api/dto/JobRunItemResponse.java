package br.com.vilareal.jobrun.api.dto;

import br.com.vilareal.jobrun.infrastructure.persistence.entity.JobRunEntity;

import java.time.Instant;
import java.util.Map;

public record JobRunItemResponse(
        Long id,
        String jobName,
        String status,
        Instant startedAt,
        Instant finishedAt,
        Long durationMs,
        Instant heartbeatAt,
        int itemsProcessed,
        int itemsFailed,
        String errorMessage,
        String errorStack,
        Map<String, Object> metadata,
        String hostInstance) {

    public static JobRunItemResponse from(JobRunEntity e) {
        return new JobRunItemResponse(
                e.getId(),
                e.getJobName(),
                e.getStatus() != null ? e.getStatus().name() : null,
                e.getStartedAt(),
                e.getFinishedAt(),
                e.getDurationMs(),
                e.getHeartbeatAt(),
                e.getItemsProcessed(),
                e.getItemsFailed(),
                e.getErrorMessage(),
                e.getErrorStack(),
                e.getMetadataJson(),
                e.getHostInstance());
    }
}
