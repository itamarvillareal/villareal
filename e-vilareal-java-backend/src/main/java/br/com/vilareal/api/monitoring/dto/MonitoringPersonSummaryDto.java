package br.com.vilareal.api.monitoring.dto;

import java.time.Instant;

public class MonitoringPersonSummaryDto {
    private Long id;
    private Long personId;
    private String nome;
    private String documentoPrincipal;
    private boolean enabled;
    private String frequencyType;
    private Instant lastRunAt;
    private Instant nextRunAt;
    private String lastStatus;
    private long totalHits;
    private long pendingReviewHits;
    private int recentFailureCount;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getPersonId() { return personId; }
    public void setPersonId(Long personId) { this.personId = personId; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getDocumentoPrincipal() { return documentoPrincipal; }
    public void setDocumentoPrincipal(String documentoPrincipal) { this.documentoPrincipal = documentoPrincipal; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getFrequencyType() { return frequencyType; }
    public void setFrequencyType(String frequencyType) { this.frequencyType = frequencyType; }
    public Instant getLastRunAt() { return lastRunAt; }
    public void setLastRunAt(Instant lastRunAt) { this.lastRunAt = lastRunAt; }
    public Instant getNextRunAt() { return nextRunAt; }
    public void setNextRunAt(Instant nextRunAt) { this.nextRunAt = nextRunAt; }
    public String getLastStatus() { return lastStatus; }
    public void setLastStatus(String lastStatus) { this.lastStatus = lastStatus; }
    public long getTotalHits() { return totalHits; }
    public void setTotalHits(long totalHits) { this.totalHits = totalHits; }
    public long getPendingReviewHits() { return pendingReviewHits; }
    public void setPendingReviewHits(long pendingReviewHits) { this.pendingReviewHits = pendingReviewHits; }
    public int getRecentFailureCount() { return recentFailureCount; }
    public void setRecentFailureCount(int recentFailureCount) { this.recentFailureCount = recentFailureCount; }
}
