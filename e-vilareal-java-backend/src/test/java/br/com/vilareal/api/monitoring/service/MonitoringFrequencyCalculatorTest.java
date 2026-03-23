package br.com.vilareal.api.monitoring.service;

import br.com.vilareal.api.monitoring.domain.MonitoringFrequencyType;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

class MonitoringFrequencyCalculatorTest {

    private final MonitoringFrequencyCalculator calc = new MonitoringFrequencyCalculator();

    @Test
    void minutes15() {
        Instant t = Instant.parse("2026-03-22T12:00:00Z");
        Instant n = calc.computeNextRun(MonitoringFrequencyType.MINUTES_15, t);
        assertEquals(t.plus(15, ChronoUnit.MINUTES), n);
    }

    @Test
    void hours6() {
        Instant t = Instant.parse("2026-03-22T10:00:00Z");
        Instant n = calc.computeNextRun(MonitoringFrequencyType.HOURS_6, t);
        assertEquals(t.plus(6, ChronoUnit.HOURS), n);
    }
}
