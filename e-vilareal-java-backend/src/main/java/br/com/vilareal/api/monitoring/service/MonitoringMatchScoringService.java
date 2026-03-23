package br.com.vilareal.api.monitoring.service;

import org.springframework.stereotype.Component;

/**
 * Score determinístico para correspondência pessoa × processo (metadados DataJud).
 */
@Component
public class MonitoringMatchScoringService {

    public record Score(String level, String reason) {
    }

    public Score scoreKnownProcessRequery() {
        return new Score("ALTO", "processo já vinculado / chave numero_processo — reconsulta DataJud");
    }

    public Score scoreDocumentKeyMatch() {
        return new Score("MEDIO", "busca por documento em índice público — conferir falso positivo");
    }

    public Score scoreNameOnly() {
        return new Score("BAIXO", "somente coincidência parcial de nome ou busca ampla — revisão obrigatória");
    }

    public Score scoreInconclusive(String detail) {
        return new Score("BAIXO", "resultado inconclusivo: " + (detail == null ? "" : detail));
    }

    public Score scoreSigiloso() {
        return new Score("MEDIO", "processo com indício de sigilo — dados mínimos na API pública");
    }
}
