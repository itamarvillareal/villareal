package br.com.vilareal.api.monitoring.dto;

public class MonitoringSearchKeyDto {
    private Long id;
    private String keyType;
    private String keyValue;
    private String normalizedValue;
    private boolean enabled;
    private int priority;
    private String notes;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getKeyType() { return keyType; }
    public void setKeyType(String keyType) { this.keyType = keyType; }
    public String getKeyValue() { return keyValue; }
    public void setKeyValue(String keyValue) { this.keyValue = keyValue; }
    public String getNormalizedValue() { return normalizedValue; }
    public void setNormalizedValue(String normalizedValue) { this.normalizedValue = normalizedValue; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
