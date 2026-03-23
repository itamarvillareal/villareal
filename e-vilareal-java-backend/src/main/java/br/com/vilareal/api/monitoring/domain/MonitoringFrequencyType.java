package br.com.vilareal.api.monitoring.domain;

/**
 * Frequência de execução do monitoramento (global ou por pessoa).
 */
public enum MonitoringFrequencyType {
    MINUTES_15,
    MINUTES_30,
    HOURS_1,
    HOURS_6,
    HOURS_12,
    DAILY,
    BUSINESS_HOURS
}
