package br.com.vilareal.api.monitoring.dto;

import br.com.vilareal.api.monitoring.domain.MonitorMode;
import br.com.vilareal.api.monitoring.domain.MonitoringFrequencyType;
import jakarta.validation.constraints.NotNull;

public class MonitoringPersonUpsertRequest {

    @NotNull
    private Long personId;

    private Boolean enabled;
    private MonitorMode monitorMode;
    private MonitoringFrequencyType globalFrequencyType;
    private Integer globalFrequencyValue;
    private String preferredTribunalsJson;
    private Boolean monitorByName;
    private Boolean monitorByCpfCnpj;
    private Boolean monitorByKnownProcesses;

    public Long getPersonId() { return personId; }
    public void setPersonId(Long personId) { this.personId = personId; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public MonitorMode getMonitorMode() { return monitorMode; }
    public void setMonitorMode(MonitorMode monitorMode) { this.monitorMode = monitorMode; }
    public MonitoringFrequencyType getGlobalFrequencyType() { return globalFrequencyType; }
    public void setGlobalFrequencyType(MonitoringFrequencyType globalFrequencyType) { this.globalFrequencyType = globalFrequencyType; }
    public Integer getGlobalFrequencyValue() { return globalFrequencyValue; }
    public void setGlobalFrequencyValue(Integer globalFrequencyValue) { this.globalFrequencyValue = globalFrequencyValue; }
    public String getPreferredTribunalsJson() { return preferredTribunalsJson; }
    public void setPreferredTribunalsJson(String preferredTribunalsJson) { this.preferredTribunalsJson = preferredTribunalsJson; }
    public Boolean getMonitorByName() { return monitorByName; }
    public void setMonitorByName(Boolean monitorByName) { this.monitorByName = monitorByName; }
    public Boolean getMonitorByCpfCnpj() { return monitorByCpfCnpj; }
    public void setMonitorByCpfCnpj(Boolean monitorByCpfCnpj) { this.monitorByCpfCnpj = monitorByCpfCnpj; }
    public Boolean getMonitorByKnownProcesses() { return monitorByKnownProcesses; }
    public void setMonitorByKnownProcesses(Boolean monitorByKnownProcesses) { this.monitorByKnownProcesses = monitorByKnownProcesses; }
}
