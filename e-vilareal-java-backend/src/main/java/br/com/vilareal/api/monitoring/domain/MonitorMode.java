package br.com.vilareal.api.monitoring.domain;

public enum MonitorMode {
    /** Estratégias A–D conforme configuração e tribunais. */
    HYBRID,
    /** Somente reconsulta de processos já conhecidos (chaves / vínculos). */
    KNOWN_PROCESSES_ONLY,
    /** Sem chamadas amplas por documento/nome (apenas metadados mínimos). */
    CONSERVATIVE
}
