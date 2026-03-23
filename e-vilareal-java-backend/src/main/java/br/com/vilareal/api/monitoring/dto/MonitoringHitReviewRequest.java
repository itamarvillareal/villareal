package br.com.vilareal.api.monitoring.dto;

import br.com.vilareal.api.monitoring.domain.HitReviewStatus;
import jakarta.validation.constraints.NotNull;

public class MonitoringHitReviewRequest {

    @NotNull
    private HitReviewStatus reviewStatus;

    private Long linkedProcessId;
    private Long linkedClientId;

    public HitReviewStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(HitReviewStatus reviewStatus) { this.reviewStatus = reviewStatus; }
    public Long getLinkedProcessId() { return linkedProcessId; }
    public void setLinkedProcessId(Long linkedProcessId) { this.linkedProcessId = linkedProcessId; }
    public Long getLinkedClientId() { return linkedClientId; }
    public void setLinkedClientId(Long linkedClientId) { this.linkedClientId = linkedClientId; }
}
