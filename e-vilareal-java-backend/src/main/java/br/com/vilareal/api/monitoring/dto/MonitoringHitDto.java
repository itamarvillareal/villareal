package br.com.vilareal.api.monitoring.dto;

import java.time.Instant;

public class MonitoringHitDto {
    private Long id;
    private Long monitoredPersonId;
    private Long monitoringRunId;
    private String tribunal;
    private String processNumber;
    private String processNumberNormalized;
    private String hitType;
    private String sourceStrategy;
    private String className;
    private String courtUnitName;
    private String lastMovementName;
    private String lastMovementAt;
    private String matchScore;
    private String matchReason;
    private String reviewStatus;
    private String suggestedLinkNote;
    private Long linkedProcessId;
    private Long linkedClientId;
    private String rawPayloadJson;
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getMonitoredPersonId() { return monitoredPersonId; }
    public void setMonitoredPersonId(Long monitoredPersonId) { this.monitoredPersonId = monitoredPersonId; }
    public Long getMonitoringRunId() { return monitoringRunId; }
    public void setMonitoringRunId(Long monitoringRunId) { this.monitoringRunId = monitoringRunId; }
    public String getTribunal() { return tribunal; }
    public void setTribunal(String tribunal) { this.tribunal = tribunal; }
    public String getProcessNumber() { return processNumber; }
    public void setProcessNumber(String processNumber) { this.processNumber = processNumber; }
    public String getProcessNumberNormalized() { return processNumberNormalized; }
    public void setProcessNumberNormalized(String processNumberNormalized) { this.processNumberNormalized = processNumberNormalized; }
    public String getHitType() { return hitType; }
    public void setHitType(String hitType) { this.hitType = hitType; }
    public String getSourceStrategy() { return sourceStrategy; }
    public void setSourceStrategy(String sourceStrategy) { this.sourceStrategy = sourceStrategy; }
    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }
    public String getCourtUnitName() { return courtUnitName; }
    public void setCourtUnitName(String courtUnitName) { this.courtUnitName = courtUnitName; }
    public String getLastMovementName() { return lastMovementName; }
    public void setLastMovementName(String lastMovementName) { this.lastMovementName = lastMovementName; }
    public String getLastMovementAt() { return lastMovementAt; }
    public void setLastMovementAt(String lastMovementAt) { this.lastMovementAt = lastMovementAt; }
    public String getMatchScore() { return matchScore; }
    public void setMatchScore(String matchScore) { this.matchScore = matchScore; }
    public String getMatchReason() { return matchReason; }
    public void setMatchReason(String matchReason) { this.matchReason = matchReason; }
    public String getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(String reviewStatus) { this.reviewStatus = reviewStatus; }
    public String getSuggestedLinkNote() { return suggestedLinkNote; }
    public void setSuggestedLinkNote(String suggestedLinkNote) { this.suggestedLinkNote = suggestedLinkNote; }
    public Long getLinkedProcessId() { return linkedProcessId; }
    public void setLinkedProcessId(Long linkedProcessId) { this.linkedProcessId = linkedProcessId; }
    public Long getLinkedClientId() { return linkedClientId; }
    public void setLinkedClientId(Long linkedClientId) { this.linkedClientId = linkedClientId; }
    public String getRawPayloadJson() { return rawPayloadJson; }
    public void setRawPayloadJson(String rawPayloadJson) { this.rawPayloadJson = rawPayloadJson; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
