package br.com.vilareal.api.monitoring.dto;

import br.com.vilareal.api.monitoring.domain.MonitoringFrequencyType;

public class MonitoringSettingsDto {
    private Long id;
    private boolean schedulerEnabled;
    private MonitoringFrequencyType defaultFrequencyType;
    private Integer defaultFrequencyValue;
    private int batchSize;
    private int retryLimit;
    private int requestTimeoutMs;
    private int cacheTtlMinutes;
    private String tribunalRateLimitsJson;
    private String strategyFlagsJson;

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
