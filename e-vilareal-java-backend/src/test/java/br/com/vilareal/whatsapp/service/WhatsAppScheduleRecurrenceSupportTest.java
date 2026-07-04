package br.com.vilareal.whatsapp.service;

import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.EnumSet;
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
        assertThat(br(datas.get(3))).isEqualTo("18/02/2027 08:00");
    }

    @Test
    void gerarRecorrenciaMensalQuantidade_tresMeses() {
        List<Instant> datas = WhatsAppScheduleRecurrenceSupport.gerarRecorrenciaMensalQuantidade(
                10, 9, 30, YearMonth.of(2026, 7), 3);

        assertThat(datas).hasSize(3);
        assertThat(br(datas.get(0))).isEqualTo("10/07/2026 09:30");
        assertThat(br(datas.get(2))).isEqualTo("10/09/2026 09:30");
    }

    @Test
    void gerarRecorrenciaMensal_dia31UsaUltimoDiaDoMes() {
        List<Instant> datas = WhatsAppScheduleRecurrenceSupport.gerarRecorrenciaMensal(
                31, 9, 0, YearMonth.of(2026, 1), YearMonth.of(2026, 3));

        assertThat(br(datas.get(1))).isEqualTo("28/02/2026 09:00");
    }

    @Test
    void gerarRecorrenciaSemanal_segundaEQuarta_duasSemanas() {
        LocalDate inicio = LocalDate.of(2026, 7, 6);
        List<Instant> datas = WhatsAppScheduleRecurrenceSupport.gerarRecorrenciaSemanal(
                inicio,
                EnumSet.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY),
                2,
                8,
                0);

        assertThat(datas).hasSize(4);
        assertThat(br(datas.get(0))).isEqualTo("06/07/2026 08:00");
        assertThat(br(datas.get(1))).isEqualTo("08/07/2026 08:00");
        assertThat(br(datas.get(2))).isEqualTo("13/07/2026 08:00");
        assertThat(br(datas.get(3))).isEqualTo("15/07/2026 08:00");
    }

    @Test
    void gerarIntervaloNoDia_aCada5Minutos() {
        LocalDate dia = LocalDate.of(2026, 7, 4);
        List<Instant> datas = WhatsAppScheduleRecurrenceSupport.gerarIntervaloNoDia(dia, 8, 0, 8, 15, 5);

        assertThat(datas).hasSize(4);
        assertThat(br(datas.get(0))).isEqualTo("04/07/2026 08:00");
        assertThat(br(datas.get(3))).isEqualTo("04/07/2026 08:15");
    }

    @Test
    void limitar_excedeMaximo() {
        LocalDate dia = LocalDate.of(2026, 7, 4);
        List<Instant> datas = WhatsAppScheduleRecurrenceSupport.gerarIntervaloNoDia(dia, 0, 0, 23, 59, 1);
        assertThat(datas.size()).isGreaterThan(WhatsAppScheduleRecurrenceSupport.MAX_OCORRENCIAS_LOTE);
        assertThatThrownBy(() -> WhatsAppScheduleRecurrenceSupport.limitar(datas))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("limite");
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
