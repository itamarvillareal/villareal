package br.com.vilareal.api.entity;

import br.com.vilareal.api.monitoring.domain.MonitoringRunStatus;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "monitoring_runs")
public class MonitoringRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "monitored_person_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_mrun_person"))
    private MonitoredPerson monitoredPerson;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private MonitoringRunStatus status;

    @Column(name = "trigger_type", nullable = false, length = 32)
    private String triggerType;

    @Column(name = "tribunal_alias", length = 128)
    private String tribunalAlias;

    @Column(name = "query_strategy", length = 64)
    private String queryStrategy;

    @Column(name = "request_payload", columnDefinition = "LONGTEXT")
    private String requestPayload;

    @Column(name = "response_summary", columnDefinition = "LONGTEXT")
    private String responseSummary;

    @Column(name = "total_hits", nullable = false)
    private int totalHits;

    @Column(name = "new_hits", nullable = false)
    private int newHits;

    @Column(name = "updated_hits", nullable = false)
    private int updatedHits;

    @Column(name = "duplicates_skipped", nullable = false)
    private int duplicatesSkipped;

    @Column(name = "error_message", columnDefinition = "LONGTEXT")
    private String errorMessage;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "limitation_note", length = 512)
    private String limitationNote;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public MonitoredPerson getMonitoredPerson() { return monitoredPerson; }
    public void setMonitoredPerson(MonitoredPerson monitoredPerson) { this.monitoredPerson = monitoredPerson; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant finishedAt) { this.finishedAt = finishedAt; }
    public MonitoringRunStatus getStatus() { return status; }
    public void setStatus(MonitoringRunStatus status) { this.status = status; }
    public String getTriggerType() { return triggerType; }
    public void setTriggerType(String triggerType) { this.triggerType = triggerType; }
    public String getTribunalAlias() { return tribunalAlias; }
    public void setTribunalAlias(String tribunalAlias) { this.tribunalAlias = tribunalAlias; }
    public String getQueryStrategy() { return queryStrategy; }
    public void setQueryStrategy(String queryStrategy) { this.queryStrategy = queryStrategy; }
    public String getRequestPayload() { return requestPayload; }
    public void setRequestPayload(String requestPayload) { this.requestPayload = requestPayload; }
    public String getResponseSummary() { return responseSummary; }
    public void setResponseSummary(String responseSummary) { this.responseSummary = responseSummary; }
    public int getTotalHits() { return totalHits; }
    public void setTotalHits(int totalHits) { this.totalHits = totalHits; }
    public int getNewHits() { return newHits; }
    public void setNewHits(int newHits) { this.newHits = newHits; }
    public int getUpdatedHits() { return updatedHits; }
    public void setUpdatedHits(int updatedHits) { this.updatedHits = updatedHits; }
    public int getDuplicatesSkipped() { return duplicatesSkipped; }
    public void setDuplicatesSkipped(int duplicatesSkipped) { this.duplicatesSkipped = duplicatesSkipped; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public Long getDurationMs() { return durationMs; }
    public void setDurationMs(Long durationMs) { this.durationMs = durationMs; }
    public String getLimitationNote() { return limitationNote; }
    public void setLimitationNote(String limitationNote) { this.limitationNote = limitationNote; }
}
