package br.com.vilareal.financeiro.application;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AcertoPeriodosDetectorTest {

    private static AcertoPeriodosDetector.LancamentoLeve cred(
            long id, LocalDate data, String valor, Long processoId) {
        return new AcertoPeriodosDetector.LancamentoLeve(
                id, data, "CREDITO", new BigDecimal(valor), false, false, processoId);
    }

    private static AcertoPeriodosDetector.LancamentoLeve deb(
            long id, LocalDate data, String valor, Long processoId) {
        return new AcertoPeriodosDetector.LancamentoLeve(
                id, data, "DEBITO", new BigDecimal(valor), true, true, processoId);
    }

    @Test
    void detectar_corteManualDepoisZeroCrossingDepoisAberto() {
        List<AcertoPeriodosDetector.LancamentoLeve> todos = List.of(
                cred(1, LocalDate.of(2023, 12, 1), "100.00", 10L),
                deb(2, LocalDate.of(2023, 12, 5), "100.00", 10L),
                cred(3, LocalDate.of(2024, 1, 15), "50.00", 11L),
                deb(4, LocalDate.of(2024, 1, 20), "50.00", 11L),
                cred(5, LocalDate.of(2024, 2, 1), "200.00", 12L));

        var resumo = AcertoPeriodosDetector.montarResumo(
                todos, LocalDate.of(2024, 1, 10), List.of());

        assertThat(resumo.getDataUltimoAcertoConhecido()).isEqualTo(LocalDate.of(2024, 1, 10));
        assertThat(resumo.getUltimoCorteData()).isEqualTo(LocalDate.of(2024, 1, 20));
        assertThat(resumo.getPeriodos()).hasSize(3);

        assertThat(resumo.getPeriodos().get(0).getStatus()).isEqualTo(AcertoPeriodosDetector.STATUS_FECHADO_MANUAL);
        assertThat(resumo.getPeriodos().get(0).getDataFim()).isEqualTo(LocalDate.of(2024, 1, 10));
        assertThat(resumo.getPeriodos().get(0).getQtdLancamentos()).isEqualTo(2);

        assertThat(resumo.getPeriodos().get(1).getStatus()).isEqualTo(AcertoPeriodosDetector.STATUS_FECHADO_AUTO);
        assertThat(resumo.getPeriodos().get(1).getDataFim()).isEqualTo(LocalDate.of(2024, 1, 20));
        assertThat(resumo.getPeriodos().get(1).getSaldoFinal()).isEqualByComparingTo("0.00");

        assertThat(resumo.getPeriodos().get(2).getStatus()).isEqualTo(AcertoPeriodosDetector.STATUS_ABERTO);
        assertThat(resumo.getPeriodos().get(2).getDataInicio()).isEqualTo(LocalDate.of(2024, 2, 1));
        assertThat(resumo.getPeriodos().get(2).getSaldoFinal()).isEqualByComparingTo("200.00");
        assertThat(resumo.getPeriodoAbertoIndice()).isEqualTo(2);
    }

    @Test
    void detectar_fechamentoFormalSobrepoeAuto() {
        List<AcertoPeriodosDetector.LancamentoLeve> todos = List.of(
                cred(1, LocalDate.of(2024, 3, 1), "80.00", 1L),
                deb(2, LocalDate.of(2024, 3, 10), "80.00", 1L));

        var formais = List.of(new AcertoPeriodosDetector.FechamentoFormal(
                99L, LocalDate.of(2024, 3, 1), LocalDate.of(2024, 3, 10), true));

        var resumo = AcertoPeriodosDetector.montarResumo(todos, null, formais);

        assertThat(resumo.getPeriodos()).hasSize(1);
        assertThat(resumo.getPeriodos().get(0).getStatus()).isEqualTo(AcertoPeriodosDetector.STATUS_FECHADO);
        assertThat(resumo.getPeriodos().get(0).getFechamentoId()).isEqualTo(99L);
        assertThat(resumo.getPeriodos().get(0).isTemPdf()).isTrue();
        assertThat(resumo.getPeriodoAbertoIndice()).isNull();
    }

    @Test
    void detectar_toleranciaZeroUmCentavo() {
        List<AcertoPeriodosDetector.LancamentoLeve> todos = List.of(
                cred(1, LocalDate.of(2025, 1, 1), "100.00", 1L),
                deb(2, LocalDate.of(2025, 1, 2), "99.99", 1L));

        var resumo = AcertoPeriodosDetector.montarResumo(todos, null, List.of());

        assertThat(resumo.getPeriodos()).hasSize(1);
        assertThat(resumo.getPeriodos().get(0).getStatus()).isEqualTo(AcertoPeriodosDetector.STATUS_FECHADO_AUTO);
    }
}
