package br.com.vilareal.api.monitoring.dto;

import java.util.List;

public class MonitoringPersonDetailDto extends MonitoringPersonSummaryDto {
    private String monitorMode;
    private boolean monitorByName;
    private boolean monitorByCpfCnpj;
    private boolean monitorByKnownProcesses;
    private String preferredTribunalsJson;
    private List<MonitoringSearchKeyDto> searchKeys;
    private List<MonitoringRunDto> recentRuns;

    public String getMonitorMode() { return monitorMode; }
    public void setMonitorMode(String monitorMode) { this.monitorMode = monitorMode; }
    public boolean isMonitorByName() { return monitorByName; }
    public void setMonitorByName(boolean monitorByName) { this.monitorByName = monitorByName; }
    public boolean isMonitorByCpfCnpj() { return monitorByCpfCnpj; }
    public void setMonitorByCpfCnpj(boolean monitorByCpfCnpj) { this.monitorByCpfCnpj = monitorByCpfCnpj; }
    public boolean isMonitorByKnownProcesses() { return monitorByKnownProcesses; }
    public void setMonitorByKnownProcesses(boolean monitorByKnownProcesses) { this.monitorByKnownProcesses = monitorByKnownProcesses; }
    public String getPreferredTribunalsJson() { return preferredTribunalsJson; }
    public void setPreferredTribunalsJson(String preferredTribunalsJson) { this.preferredTribunalsJson = preferredTribunalsJson; }
    public List<MonitoringSearchKeyDto> getSearchKeys() { return searchKeys; }
    public void setSearchKeys(List<MonitoringSearchKeyDto> searchKeys) { this.searchKeys = searchKeys; }
    public List<MonitoringRunDto> getRecentRuns() { return recentRuns; }
    public void setRecentRuns(List<MonitoringRunDto> recentRuns) { this.recentRuns = recentRuns; }
}
