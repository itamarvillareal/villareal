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
                id, data, "CREDITO", new BigDecimal(valor), false, false, processoId, null, null, null);
    }

    private static AcertoPeriodosDetector.LancamentoLeve deb(
            long id, LocalDate data, String valor, Long processoId) {
        return new AcertoPeriodosDetector.LancamentoLeve(
                id, data, "DEBITO", new BigDecimal(valor), true, true, processoId, null, null, null);
    }

    private static AcertoPeriodosDetector.LancamentoLeve debGrupo(
            long id,
            LocalDate data,
            String valor,
            Long processoId,
            String grupo,
            String resumo,
            Integer numeroInterno) {
        return new AcertoPeriodosDetector.LancamentoLeve(
                id,
                data,
                "DEBITO",
                new BigDecimal(valor),
                false,
                false,
                processoId,
                grupo,
                resumo,
                numeroInterno);
    }

    private static AcertoPeriodosDetector.LancamentoLeve credGrupo(
            long id, LocalDate data, String valor, String grupo) {
        return new AcertoPeriodosDetector.LancamentoLeve(
                id, data, "CREDITO", new BigDecimal(valor), false, false, null, grupo, null, null);
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
    void detectar_grupoCompensacaoZeradoViraCard() {
        String grupo = "CZ-B728-5494";
        List<AcertoPeriodosDetector.LancamentoLeve> todos = List.of(
                debGrupo(
                        165252,
                        LocalDate.of(2020, 8, 28),
                        "10687.76",
                        9L,
                        grupo,
                        "Compensado no Contrato mensal de honorários",
                        9),
                credGrupo(165254, LocalDate.of(2020, 8, 28), "2000.00", grupo),
                credGrupo(165255, LocalDate.of(2020, 8, 28), "2000.00", grupo),
                credGrupo(165256, LocalDate.of(2020, 8, 28), "2000.00", grupo),
                credGrupo(165257, LocalDate.of(2020, 8, 28), "2000.00", grupo),
                credGrupo(165258, LocalDate.of(2020, 8, 28), "2000.00", grupo),
                credGrupo(165259, LocalDate.of(2020, 8, 28), "687.76", grupo),
                cred(9, LocalDate.of(2024, 2, 1), "100.00", 12L));

        var resumo = AcertoPeriodosDetector.montarResumo(todos, null, List.of());

        assertThat(resumo.getPeriodos()).hasSize(2);
        assertThat(resumo.getPeriodos().get(0).getStatus()).isEqualTo(AcertoPeriodosDetector.STATUS_FECHADO_GRUPO);
        assertThat(resumo.getPeriodos().get(0).getTipoPeriodo()).isEqualTo("CARD");
        assertThat(resumo.getPeriodos().get(0).getGrupoCompensacao()).isEqualTo(grupo);
        assertThat(resumo.getPeriodos().get(0).getTitulo()).isEqualTo("Compensado no Contrato mensal de honorários");
        assertThat(resumo.getPeriodos().get(0).getNumeroInternoProcesso()).isEqualTo(9);
        assertThat(resumo.getPeriodos().get(0).getQtdLancamentos()).isEqualTo(7);
        assertThat(resumo.getPeriodos().get(0).getPendentes()).isZero();
        assertThat(resumo.getPeriodos().get(1).getStatus()).isEqualTo(AcertoPeriodosDetector.STATUS_ABERTO);
    }

    @Test
    void detectar_cardVisivelMesmoComCorteManual() {
        String grupo = "CZ-B728-5494";
        List<AcertoPeriodosDetector.LancamentoLeve> card = List.of(
                debGrupo(
                        165252,
                        LocalDate.of(2020, 8, 28),
                        "10687.76",
                        9L,
                        grupo,
                        "Compensado no Contrato mensal de honorários",
                        9),
                credGrupo(165254, LocalDate.of(2020, 8, 28), "2000.00", grupo),
                credGrupo(165255, LocalDate.of(2020, 8, 28), "2000.00", grupo),
                credGrupo(165256, LocalDate.of(2020, 8, 28), "2000.00", grupo),
                credGrupo(165257, LocalDate.of(2020, 8, 28), "2000.00", grupo),
                credGrupo(165258, LocalDate.of(2020, 8, 28), "2000.00", grupo),
                credGrupo(165259, LocalDate.of(2020, 8, 28), "687.76", grupo));
        List<AcertoPeriodosDetector.LancamentoLeve> todos = new java.util.ArrayList<>(card);
        todos.add(cred(1, LocalDate.of(2023, 12, 1), "100.00", 10L));
        todos.add(deb(2, LocalDate.of(2023, 12, 5), "100.00", 10L));
        todos.add(cred(3, LocalDate.of(2024, 2, 1), "200.00", 12L));

        var resumo = AcertoPeriodosDetector.montarResumo(
                todos, LocalDate.of(2024, 1, 10), List.of());

        assertThat(resumo.getPeriodos()).hasSize(3);

        assertThat(resumo.getPeriodos().get(0).getStatus()).isEqualTo(AcertoPeriodosDetector.STATUS_FECHADO_GRUPO);
        assertThat(resumo.getPeriodos().get(0).getGrupoCompensacao()).isEqualTo(grupo);
        assertThat(resumo.getPeriodos().get(0).getQtdLancamentos()).isEqualTo(7);

        assertThat(resumo.getPeriodos().get(1).getStatus()).isEqualTo(AcertoPeriodosDetector.STATUS_FECHADO_MANUAL);
        assertThat(resumo.getPeriodos().get(1).getQtdLancamentos()).isEqualTo(2);
        assertThat(resumo.getPeriodos().get(1).getTipoPeriodo()).isEqualTo("HISTORICO");

        assertThat(resumo.getPeriodos().get(2).getStatus()).isEqualTo(AcertoPeriodosDetector.STATUS_ABERTO);
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

    @Test
    void extrairResumoDetalhada_removePrefixoRowId() {
        assertThat(AcertoPeriodosDetector.extrairResumoDetalhada(
                        "5494 · Compensado no Contrato mensal de honorários [CC_CLI:728] · migrado"))
                .isEqualTo("Compensado no Contrato mensal de honorários");
    }
}
