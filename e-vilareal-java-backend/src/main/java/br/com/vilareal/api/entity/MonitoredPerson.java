package br.com.vilareal.api.entity;

import br.com.vilareal.api.monitoring.domain.MonitorMode;
import br.com.vilareal.api.monitoring.domain.MonitoringFrequencyType;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "monitored_people", indexes = {
        @Index(name = "idx_monitored_people_schedule", columnList = "enabled,next_run_at")
})
public class MonitoredPerson {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "person_id", nullable = false, unique = true,
            foreignKey = @ForeignKey(name = "fk_monitored_people_person"))
    private CadastroPessoa person;

    @Column(nullable = false)
    private boolean enabled = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "monitor_mode", nullable = false, length = 40)
    private MonitorMode monitorMode = MonitorMode.HYBRID;

    @Enumerated(EnumType.STRING)
    @Column(name = "global_frequency_type", nullable = false, length = 32)
    private MonitoringFrequencyType globalFrequencyType = MonitoringFrequencyType.HOURS_6;

    @Column(name = "global_frequency_value")
    private Integer globalFrequencyValue;

    @Column(name = "preferred_tribunals_json", columnDefinition = "JSON")
    private String preferredTribunalsJson;

    @Column(name = "monitor_by_name", nullable = false)
    private boolean monitorByName;

    @Column(name = "monitor_by_cpf_cnpj", nullable = false)
    private boolean monitorByCpfCnpj;

    @Column(name = "monitor_by_known_processes", nullable = false)
    private boolean monitorByKnownProcesses = true;

    @Column(name = "last_run_at")
    private Instant lastRunAt;

    @Column(name = "next_run_at")
    private Instant nextRunAt;

    @Column(name = "last_status", length = 128)
    private String lastStatus;

    @Column(name = "confidence_policy", nullable = false, length = 32)
    private String confidencePolicy = "STANDARD";

    @Column(name = "execution_lock_until")
    private Instant executionLockUntil;

    @Column(name = "recent_failure_count", nullable = false)
    private int recentFailureCount;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public CadastroPessoa getPerson() { return person; }
    public void setPerson(CadastroPessoa person) { this.person = person; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public MonitorMode getMonitorMode() { return monitorMode; }
    public void setMonitorMode(MonitorMode monitorMode) { this.monitorMode = monitorMode; }
    public MonitoringFrequencyType getGlobalFrequencyType() { return globalFrequencyType; }
    public void setGlobalFrequencyType(MonitoringFrequencyType globalFrequencyType) { this.globalFrequencyType = globalFrequencyType; }
    public Integer getGlobalFrequencyValue() { return globalFrequencyValue; }
    public void setGlobalFrequencyValue(Integer globalFrequencyValue) { this.globalFrequencyValue = globalFrequencyValue; }
    public String getPreferredTribunalsJson() { return preferredTribunalsJson; }
    public void setPreferredTribunalsJson(String preferredTribunalsJson) { this.preferredTribunalsJson = preferredTribunalsJson; }
    public boolean isMonitorByName() { return monitorByName; }
    public void setMonitorByName(boolean monitorByName) { this.monitorByName = monitorByName; }
    public boolean isMonitorByCpfCnpj() { return monitorByCpfCnpj; }
    public void setMonitorByCpfCnpj(boolean monitorByCpfCnpj) { this.monitorByCpfCnpj = monitorByCpfCnpj; }
    public boolean isMonitorByKnownProcesses() { return monitorByKnownProcesses; }
    public void setMonitorByKnownProcesses(boolean monitorByKnownProcesses) { this.monitorByKnownProcesses = monitorByKnownProcesses; }
    public Instant getLastRunAt() { return lastRunAt; }
    public void setLastRunAt(Instant lastRunAt) { this.lastRunAt = lastRunAt; }
    public Instant getNextRunAt() { return nextRunAt; }
    public void setNextRunAt(Instant nextRunAt) { this.nextRunAt = nextRunAt; }
    public String getLastStatus() { return lastStatus; }
    public void setLastStatus(String lastStatus) { this.lastStatus = lastStatus; }
    public String getConfidencePolicy() { return confidencePolicy; }
    public void setConfidencePolicy(String confidencePolicy) { this.confidencePolicy = confidencePolicy; }
    public Instant getExecutionLockUntil() { return executionLockUntil; }
    public void setExecutionLockUntil(Instant executionLockUntil) { this.executionLockUntil = executionLockUntil; }
    public int getRecentFailureCount() { return recentFailureCount; }
    public void setRecentFailureCount(int recentFailureCount) { this.recentFailureCount = recentFailureCount; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
