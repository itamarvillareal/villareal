package br.com.vilareal.api.monitoring.dto;

import java.time.Instant;

public class MonitoringRunDto {
    private Long id;
    private Long monitoredPersonId;
    private Instant startedAt;
    private Instant finishedAt;
    private String status;
    private String triggerType;
    private String tribunalAlias;
    private String queryStrategy;
    private int totalHits;
    private int newHits;
    private int duplicatesSkipped;
    private String errorMessage;
    private Long durationMs;
    private String limitationNote;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getMonitoredPersonId() { return monitoredPersonId; }
    public void setMonitoredPersonId(Long monitoredPersonId) { this.monitoredPersonId = monitoredPersonId; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant finishedAt) { this.finishedAt = finishedAt; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTriggerType() { return triggerType; }
    public void setTriggerType(String triggerType) { this.triggerType = triggerType; }
    public String getTribunalAlias() { return tribunalAlias; }
    public void setTribunalAlias(String tribunalAlias) { this.tribunalAlias = tribunalAlias; }
    public String getQueryStrategy() { return queryStrategy; }
    public void setQueryStrategy(String queryStrategy) { this.queryStrategy = queryStrategy; }
    public int getTotalHits() { return totalHits; }
    public void setTotalHits(int totalHits) { this.totalHits = totalHits; }
    public int getNewHits() { return newHits; }
    public void setNewHits(int newHits) { this.newHits = newHits; }
    public int getDuplicatesSkipped() { return duplicatesSkipped; }
    public void setDuplicatesSkipped(int duplicatesSkipped) { this.duplicatesSkipped = duplicatesSkipped; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public Long getDurationMs() { return durationMs; }
    public void setDurationMs(Long durationMs) { this.durationMs = durationMs; }
    public String getLimitationNote() { return limitationNote; }
    public void setLimitationNote(String limitationNote) { this.limitationNote = limitationNote; }
}
