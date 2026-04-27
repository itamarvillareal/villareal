package br.com.vilareal.iptu.application;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class IptuCalculadoraTest {

    private static final BigDecimal TOL = new BigDecimal("0.02");

    @Test
    void anoInteiro_dozeParcelasIguais_somaValorAnual() {
        var r = IptuCalculadora.calcular(
                new BigDecimal("1200"),
                2025,
                LocalDate.of(2025, 1, 1),
                LocalDate.of(2025, 12, 31),
                30);
        assertThat(r.parcelas()).hasSize(12);
        assertThat(r.parcelas()).allMatch(p -> p.valor().compareTo(new BigDecimal("100.00")) == 0);
        assertThat(r.totalDevido()).isCloseTo(new BigDecimal("1200.00"), within(TOL));
    }

    @Test
    void jul15aDez31_2025_anual1200_exemploEnunciado() {
        var r = IptuCalculadora.calcular(
                new BigDecimal("1200"),
                2025,
                LocalDate.of(2025, 7, 15),
                null,
                30);
        assertThat(r.parcelas()).hasSize(6);
        assertThat(r.parcelas().getFirst().competencia()).isEqualTo(YearMonth.of(2025, 7));
        assertThat(r.parcelas().getFirst().diasCobrados()).isEqualTo(17);
        assertThat(r.parcelas().getFirst().mesCompleto()).isFalse();
        assertThat(r.parcelas().getFirst().valor()).isCloseTo(new BigDecimal("56.67"), within(TOL));
        for (int i = 1; i < 6; i++) {
            assertThat(r.parcelas().get(i).mesCompleto()).isTrue();
            assertThat(r.parcelas().get(i).valor()).isCloseTo(new BigDecimal("100.00"), within(TOL));
        }
        assertThat(r.totalDevido()).isCloseTo(new BigDecimal("556.67"), within(TOL));
    }

    @Test
    void fev2025_mesCheio_naoBissexto() {
        var r = IptuCalculadora.calcular(
                new BigDecimal("1200"),
                2025,
                LocalDate.of(2025, 2, 1),
                LocalDate.of(2025, 2, 28),
                30);
        assertThat(r.parcelas()).hasSize(1);
        assertThat(r.parcelas().getFirst().mesCompleto()).isTrue();
        assertThat(r.parcelas().getFirst().valor()).isCloseTo(new BigDecimal("100.00"), within(TOL));
    }

    @Test
    void fev2024_mesCheio_bissexto() {
        var r = IptuCalculadora.calcular(
                new BigDecimal("1200"),
                2024,
                LocalDate.of(2024, 2, 1),
                LocalDate.of(2024, 2, 29),
                30);
        assertThat(r.parcelas()).hasSize(1);
        assertThat(r.parcelas().getFirst().mesCompleto()).isTrue();
        assertThat(r.parcelas().getFirst().valor()).isCloseTo(new BigDecimal("100.00"), within(TOL));
    }

    @Test
    void fev15aMar15_parcelasParciais() {
        var r = IptuCalculadora.calcular(
                new BigDecimal("1200"),
                2025,
                LocalDate.of(2025, 2, 15),
                LocalDate.of(2025, 3, 15),
                30);
        assertThat(r.parcelas()).hasSize(2);
        assertThat(r.parcelas().get(0).competencia()).isEqualTo(YearMonth.of(2025, 2));
        assertThat(r.parcelas().get(0).diasCobrados()).isEqualTo(14);
        assertThat(r.parcelas().get(1).competencia()).isEqualTo(YearMonth.of(2025, 3));
        assertThat(r.parcelas().get(1).diasCobrados()).isEqualTo(15);
    }

    @Test
    void contratoForaDoAno_parcelasVazias() {
        var r = IptuCalculadora.calcular(
                new BigDecimal("1200"),
                2025,
                LocalDate.of(2024, 6, 1),
                LocalDate.of(2024, 8, 31),
                30);
        assertThat(r.parcelas()).isEmpty();
        assertThat(r.totalDevido()).isEqualByComparingTo(BigDecimal.ZERO.setScale(2));
    }
}
