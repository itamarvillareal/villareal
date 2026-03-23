package br.com.vilareal.api.entity;

import br.com.vilareal.api.monitoring.domain.MonitoringFrequencyType;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "monitoring_settings")
public class MonitoringSettings {

    @Id
    private Long id = 1L;

    @Column(name = "scheduler_enabled", nullable = false)
    private boolean schedulerEnabled = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_frequency_type", nullable = false, length = 32)
    private MonitoringFrequencyType defaultFrequencyType = MonitoringFrequencyType.HOURS_6;

    @Column(name = "default_frequency_value")
    private Integer defaultFrequencyValue;

    @Column(name = "batch_size", nullable = false)
    private int batchSize = 5;

    @Column(name = "retry_limit", nullable = false)
    private int retryLimit = 3;

    @Column(name = "request_timeout_ms", nullable = false)
    private int requestTimeoutMs = 28000;

    @Column(name = "cache_ttl_minutes", nullable = false)
    private int cacheTtlMinutes = 60;

    @Column(name = "tribunal_rate_limits_json", columnDefinition = "JSON")
    private String tribunalRateLimitsJson;

    @Column(name = "strategy_flags_json", columnDefinition = "JSON")
    private String strategyFlagsJson;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public boolean isSchedulerEnabled() { return schedulerEnabled; }
    public void setSchedulerEnabled(boolean schedulerEnabled) { this.schedulerEnabled = schedulerEnabled; }
    public MonitoringFrequencyType getDefaultFrequencyType() { return defaultFrequencyType; }
    public void setDefaultFrequencyType(MonitoringFrequencyType defaultFrequencyType) { this.defaultFrequencyType = defaultFrequencyType; }
    public Integer getDefaultFrequencyValue() { return defaultFrequencyValue; }
    public void setDefaultFrequencyValue(Integer defaultFrequencyValue) { this.defaultFrequencyValue = defaultFrequencyValue; }
    public int getBatchSize() { return batchSize; }
    public void setBatchSize(int batchSize) { this.batchSize = batchSize; }
    public int getRetryLimit() { return retryLimit; }
    public void setRetryLimit(int retryLimit) { this.retryLimit = retryLimit; }
    public int getRequestTimeoutMs() { return requestTimeoutMs; }
    public void setRequestTimeoutMs(int requestTimeoutMs) { this.requestTimeoutMs = requestTimeoutMs; }
    public int getCacheTtlMinutes() { return cacheTtlMinutes; }
    public void setCacheTtlMinutes(int cacheTtlMinutes) { this.cacheTtlMinutes = cacheTtlMinutes; }
    public String getTribunalRateLimitsJson() { return tribunalRateLimitsJson; }
    public void setTribunalRateLimitsJson(String tribunalRateLimitsJson) { this.tribunalRateLimitsJson = tribunalRateLimitsJson; }
    public String getStrategyFlagsJson() { return strategyFlagsJson; }
    public void setStrategyFlagsJson(String strategyFlagsJson) { this.strategyFlagsJson = strategyFlagsJson; }
}
