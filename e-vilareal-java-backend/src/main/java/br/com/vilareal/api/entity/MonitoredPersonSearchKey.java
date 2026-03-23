package br.com.vilareal.api.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "monitored_people_search_keys")
public class MonitoredPersonSearchKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "monitored_person_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_mpsk_monitored"))
    private MonitoredPerson monitoredPerson;

    @Column(name = "key_type", nullable = false, length = 32)
    private String keyType;

    @Column(name = "key_value", nullable = false, length = 512)
    private String keyValue;

    @Column(name = "normalized_value", length = 512)
    private String normalizedValue;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(nullable = false)
    private int priority;

    @Column(length = 500)
    private String notes;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public MonitoredPerson getMonitoredPerson() { return monitoredPerson; }
    public void setMonitoredPerson(MonitoredPerson monitoredPerson) { this.monitoredPerson = monitoredPerson; }
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
