package br.com.vilareal.api.monitoring.domain;

public enum MonitoringRunStatus {
    RUNNING,
    SUCCESS,
    PARTIAL,
    FAILED,
    /** Tribunal/índice sem suporte público útil para busca direta por pessoa. */
    NO_PUBLIC_SUPPORT,
    SKIPPED
}
