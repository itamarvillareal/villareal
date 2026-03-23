package br.com.vilareal.api.monitoring.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MonitoringMatchScoringServiceTest {

    private final MonitoringMatchScoringService svc = new MonitoringMatchScoringService();

    @Test
    void knownProcessIsHigh() {
        var s = svc.scoreKnownProcessRequery();
        assertEquals("ALTO", s.level());
        assertTrue(s.reason().contains("numero_processo"));
    }

    @Test
    void inconclusiveAppendsDetail() {
        var s = svc.scoreInconclusive("índice sem campo");
        assertEquals("BAIXO", s.level());
        assertTrue(s.reason().contains("índice sem campo"));
    }
}
