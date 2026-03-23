package br.com.vilareal.api.monitoring.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MonitoringDedupServiceTest {

    private final MonitoringDedupService svc = new MonitoringDedupService();

    @Test
    void sameInputSameHash() {
        String a = svc.buildHash(1L, "TJGO", "0000000-00.0000.0.00.0000", "X", "2026-01-01", "fp");
        String b = svc.buildHash(1L, "TJGO", "0000000-00.0000.0.00.0000", "X", "2026-01-01", "fp");
        assertEquals(a, b);
    }

    @Test
    void differentMovementDifferentHash() {
        String a = svc.buildHash(1L, "TJGO", "0000000-00.0000.0.00.0000", "X", "2026-01-01", "fp");
        String b = svc.buildHash(1L, "TJGO", "0000000-00.0000.0.00.0000", "X", "2026-01-02", "fp");
        assertNotEquals(a, b);
    }
}
