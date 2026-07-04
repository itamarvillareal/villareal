package br.com.vilareal.whatsapp.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WhatsAppScheduleRecurrenceSupportTest {

    private static final ZoneId BR = ZoneId.of("America/Sao_Paulo");

    @Test
    void gerarRecorrenciaMensal_nov2026AFev2027_dia18() {
        List<Instant> datas = WhatsAppScheduleRecurrenceSupport.gerarRecorrenciaMensal(
                18, 8, 0, YearMonth.of(2026, 11), YearMonth.of(2027, 2));

        assertThat(datas).hasSize(4);
        assertThat(br(datas.get(0))).isEqualTo("18/11/2026 08:00");
        assertThat(br(datas.get(1))).isEqualTo("18/12/2026 08:00");
        assertThat(br(datas.get(2))).isEqualTo("18/01/2027 08:00");
        assertThat(br(datas.get(3))).isEqualTo("18/02/2027 08:00");
    }

    @Test
    void gerarRecorrenciaMensal_dia31UsaUltimoDiaDoMes() {
        List<Instant> datas = WhatsAppScheduleRecurrenceSupport.gerarRecorrenciaMensal(
                31, 9, 0, YearMonth.of(2026, 1), YearMonth.of(2026, 3));

        assertThat(datas).hasSize(3);
        assertThat(br(datas.get(0))).isEqualTo("31/01/2026 09:00");
        assertThat(br(datas.get(1))).isEqualTo("28/02/2026 09:00");
        assertThat(br(datas.get(2))).isEqualTo("31/03/2026 09:00");
    }

    @Test
    void parseYearMonth_invalido() {
        assertThatThrownBy(() -> WhatsAppScheduleRecurrenceSupport.parseYearMonth("2026/11"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static String br(Instant instant) {
        ZonedDateTime z = instant.atZone(BR);
        return "%02d/%02d/%04d %02d:%02d"
                .formatted(z.getDayOfMonth(), z.getMonthValue(), z.getYear(), z.getHour(), z.getMinute());
    }
}
