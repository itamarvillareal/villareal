package br.com.vilareal.api.monitoring.service;

import br.com.vilareal.api.monitoring.domain.MonitoringFrequencyType;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;

@Component
public class MonitoringFrequencyCalculator {

    private static final ZoneId DEFAULT_ZONE = ZoneId.of("America/Sao_Paulo");

    public Instant computeNextRun(MonitoringFrequencyType type, Instant from) {
        return computeNextRun(type, from, DEFAULT_ZONE);
    }

    public Instant computeNextRun(MonitoringFrequencyType type, Instant from, ZoneId zone) {
        if (from == null) {
            from = Instant.now();
        }
        ZonedDateTime z = from.atZone(zone);
        return switch (type) {
            case MINUTES_15 -> from.plus(15, ChronoUnit.MINUTES);
            case MINUTES_30 -> from.plus(30, ChronoUnit.MINUTES);
            case HOURS_1 -> from.plus(1, ChronoUnit.HOURS);
            case HOURS_6 -> from.plus(6, ChronoUnit.HOURS);
            case HOURS_12 -> from.plus(12, ChronoUnit.HOURS);
            case DAILY -> z.plusDays(1).with(LocalTime.of(8, 0)).toInstant();
            case BUSINESS_HOURS -> nextBusinessSlot(z);
        };
    }

    private Instant nextBusinessSlot(ZonedDateTime z) {
        ZonedDateTime cur = z;
        for (int i = 0; i < 14; i++) {
            DayOfWeek d = cur.getDayOfWeek();
            if (d != DayOfWeek.SATURDAY && d != DayOfWeek.SUNDAY) {
                int hour = cur.getHour();
                if (hour < 9) {
                    return cur.with(LocalTime.of(9, 0)).toInstant();
                }
                if (hour < 18) {
                    return cur.plus(4, ChronoUnit.HOURS).toInstant();
                }
            }
            cur = cur.plusDays(1).with(LocalTime.of(9, 0));
        }
        return z.plusDays(1).toInstant();
    }
}
