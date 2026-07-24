package br.com.vilareal.patrimonio.domain.finance;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Casos de aceite do briefing §10 + revisão T1–T6.
 */
class AmortizacaoComparadorAceiteTest {

    @Test
    void caso1_amortizacaoFavoravel_recomendaAmortizar() {
        AmortizacaoComparacao r = AmortizacaoComparador.comparar(entrada(
                new BigDecimal("300000"),
                new BigDecimal("13"),
                new BigDecimal("10.2"),
                new BigDecimal("8000"),
                new BigDecimal("100000"),
                new BigDecimal("100000"),
                new BigDecimal("50000"),
                SistemaAmortizacao.PRICE,
                false));

        assertEquals(RecomendacaoAmortizacao.AMORTIZAR, r.recomendacao());
        assertEquals(0, new BigDecimal("2.8000").compareTo(r.diferencialPpAa().setScale(4)));
    }

    /** T1 — Recomendação negativa explícita. */
    @Test
    void t1_recomendacaoNegativa_desaconselhaComDestruicaoDeValor() {
        AmortizacaoComparacao r = AmortizacaoComparador.comparar(entrada(
                new BigDecimal("300000"),
                new BigDecimal("8.5"),
                new BigDecimal("10.2"),
                new BigDecimal("8000"),
                new BigDecimal("100000"),
                new BigDecimal("100000"),
                new BigDecimal("50000"),
                SistemaAmortizacao.PRICE,
                false));

        assertEquals(RecomendacaoAmortizacao.MANTER_INVESTIDO, r.recomendacao());
        assertNotEquals(RecomendacaoAmortizacao.INDIFERENTE, r.recomendacao());
        assertNotEquals(RecomendacaoAmortizacao.AMORTIZAR, r.recomendacao());
        assertTrue(r.diferencialPpAa().compareTo(BigDecimal.ZERO) < 0);
        String msg = r.explicacao().toLowerCase();
        assertTrue(msg.contains("destrói valor") || msg.contains("destroi valor") || msg.contains("desaconselhado"),
                "mensagem deve explicar destruição de valor: " + r.explicacao());
    }

    /** T2 — Consórcio não contemplado: sem economia de juros. */
    @Test
    void t2_consorcioNaoContemplado_semEconomiaDeJuros() {
        AmortizacaoComparacao r = AmortizacaoComparador.comparar(new AmortizacaoComparador.Entrada(
                SistemaAmortizacao.CONSORCIO,
                new BigDecimal("100000"),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                120,
                new BigDecimal("5000"),
                new BigDecimal("200"), // taxa admin mensal
                LocalDate.of(2026, 8, 15),
                new BigDecimal("5000"),
                new BigDecimal("10.2"),
                AmortizacaoComparacao.ModalidadeAmortizacao.REDUZIR_PRAZO,
                false,
                new BigDecimal("50000"),
                new BigDecimal("100000"),
                new BigDecimal("50000")));

        assertEquals(RecomendacaoAmortizacao.CONSORCIO_NAO_APLICA_JUROS, r.recomendacao());
        assertEquals(0, MoneyMath.ZERO.compareTo(r.economiaValorPresente()),
                "economia de juros deve ser zero");
        assertEquals(0, r.mesesEliminados());
        assertTrue(r.explicacao().contains("não há juros") || r.explicacao().contains("não há juros a economizar")
                || r.explicacao().contains("NÃO CONTEMPLADO"));
        assertTrue(r.parcelasEliminadas() == null || r.parcelasEliminadas().isEmpty()
                || r.parcelasEliminadas().stream().allMatch(p -> p.juros().compareTo(BigDecimal.ZERO) == 0));
    }

    /** T3 — Pós-fixado: bases alinhadas antes da comparação. */
    @Test
    void t3_dividaPosFixada_basesAlinhadas() {
        AmortizacaoComparacao r = AmortizacaoComparador.comparar(new AmortizacaoComparador.Entrada(
                SistemaAmortizacao.PRICE,
                new BigDecimal("300000"),
                new BigDecimal("6.0"), // spread real IPCA+6 se não projetado
                new BigDecimal("6.0"),
                180,
                new BigDecimal("8000"),
                BigDecimal.ZERO,
                LocalDate.of(2026, 8, 15),
                new BigDecimal("8000"),
                new BigDecimal("10.2"), // CDI líquido nominal
                AmortizacaoComparacao.ModalidadeAmortizacao.REDUZIR_PRAZO,
                false,
                new BigDecimal("100000"),
                new BigDecimal("100000"),
                new BigDecimal("50000"),
                "IPCA+",
                "CDI",
                new BigDecimal("4.5"), // inflação projetada
                false, // CET ainda não projetado
                null,
                null));

        assertEquals("NOMINAL_PROJETADO", r.baseComparacao());
        assertTrue(r.cetDividaAa().compareTo(new BigDecimal("6.0")) > 0,
                "CET projetado deve superar o spread real");
        assertTrue(r.avisoBase() != null && r.avisoBase().toLowerCase().contains("nominal"));
        // Após projeção, comparação usa mesma base
        assertEquals(r.baseComparacao(), "NOMINAL_PROJETADO");
    }

    /** T4 — IR regressivo na alternativa com horizonte idêntico. */
    @Test
    void t4_irNaAlternativa_horizonteIdentico() {
        int prazoMeses = 24; // 720 dias → alíquota 17,5%
        int horizonteDias = IrRegressivoCalculator.mesesParaDias(prazoMeses);
        assertEquals(720, horizonteDias);
        assertEquals(0, new BigDecimal("0.175").compareTo(IrRegressivoCalculator.aliquota(horizonteDias)));

        BigDecimal bruto = new BigDecimal("12.0");
        BigDecimal liquidoEsperado = IrRegressivoCalculator.liquidoDeBrutoPercentAa(bruto, horizonteDias);
        // 12 * (1-0.175) = 9.9
        assertEquals(0, new BigDecimal("9.9000").compareTo(liquidoEsperado));

        AmortizacaoComparacao r = AmortizacaoComparador.comparar(new AmortizacaoComparador.Entrada(
                SistemaAmortizacao.PRICE,
                new BigDecimal("200000"),
                new BigDecimal("11"),
                new BigDecimal("11"),
                prazoMeses,
                new BigDecimal("5000"),
                BigDecimal.ZERO,
                LocalDate.of(2026, 8, 15),
                new BigDecimal("5000"),
                null, // líquida virá do bruto
                AmortizacaoComparacao.ModalidadeAmortizacao.REDUZIR_PRAZO,
                false,
                new BigDecimal("100000"),
                new BigDecimal("100000"),
                new BigDecimal("50000"),
                "PREFIXADO",
                "CDI",
                null,
                true,
                bruto,
                horizonteDias));

        assertEquals(horizonteDias, r.horizonteComparacaoDias());
        assertEquals(0, liquidoEsperado.compareTo(r.retornoAlternativaLiquidaAa().setScale(4)));
        assertEquals(0, new BigDecimal("17.50").compareTo(r.aliquotaIrAlternativa()));
    }

    /** T5 — Fronteira do período de reflexão. */
    @Test
    void t5_fronteiraPeriodoReflexao() {
        BigDecimal parcela = new BigDecimal("8000.00");
        assertTrue(AmortizacaoComparador.acionaPeriodoReflexao(
                new BigDecimal("8000.00"), parcela, BigDecimal.ONE),
                "exatamente 1 parcela deve acionar");
        assertFalse(AmortizacaoComparador.acionaPeriodoReflexao(
                new BigDecimal("7999.99"), parcela, BigDecimal.ONE),
                "um centavo abaixo não deve acionar");
    }

    /** T6 — Caixa vinculado: disponível real 15k. */
    @Test
    void t6_caixaVinculado_bloqueiaAcimaDoLivre() {
        // total 60k, vinculado 45k → livre 15k
        AmortizacaoComparacao ok = AmortizacaoComparador.comparar(entrada(
                new BigDecimal("300000"),
                new BigDecimal("13"),
                new BigDecimal("10.2"),
                new BigDecimal("15000"),
                new BigDecimal("15000"),
                new BigDecimal("100000"),
                new BigDecimal("50000"),
                SistemaAmortizacao.PRICE,
                false));
        assertNotEquals(RecomendacaoAmortizacao.BLOQUEADO_LIQUIDEZ, ok.recomendacao());

        AmortizacaoComparacao bloqueado = AmortizacaoComparador.comparar(entrada(
                new BigDecimal("300000"),
                new BigDecimal("13"),
                new BigDecimal("10.2"),
                new BigDecimal("15000.01"),
                new BigDecimal("15000"),
                new BigDecimal("100000"),
                new BigDecimal("50000"),
                SistemaAmortizacao.PRICE,
                false));
        assertEquals(RecomendacaoAmortizacao.BLOQUEADO_LIQUIDEZ, bloqueado.recomendacao());
        assertTrue(bloqueado.explicacao().contains("15") || bloqueado.explicacao().toLowerCase().contains("disponível"));
    }

    @Test
    void caso3_armadilhaMesesEliminados_exibeVpETaxaImplicita() {
        List<ParcelaCronograma> cronograma = CronogramaAmortizacaoCalculator.gerar(
                SistemaAmortizacao.PRICE,
                new BigDecimal("300000"),
                MoneyMath.percentToDecimal(new BigDecimal("10")),
                180,
                LocalDate.of(2026, 8, 15),
                BigDecimal.ZERO);

        AmortizacaoComparacao r = AmortizacaoComparador.comparar(new AmortizacaoComparador.Entrada(
                SistemaAmortizacao.PRICE,
                new BigDecimal("300000"),
                new BigDecimal("10"),
                new BigDecimal("10"),
                180,
                new BigDecimal("8000"),
                BigDecimal.ZERO,
                LocalDate.of(2026, 8, 15),
                new BigDecimal("8000"),
                new BigDecimal("10.2"),
                AmortizacaoComparacao.ModalidadeAmortizacao.REDUZIR_PRAZO,
                false,
                new BigDecimal("100000"),
                new BigDecimal("100000"),
                new BigDecimal("50000")));

        assertTrue(r.mesesEliminados() > 0);
        assertTrue(r.economiaValorPresente().compareTo(r.valorNominalEliminado()) < 0);
        assertEquals(180, cronograma.size());
    }

    @Test
    void irRegressivo_faixas() {
        assertEquals(0, new BigDecimal("0.225").compareTo(IrRegressivoCalculator.aliquota(180)));
        assertEquals(0, new BigDecimal("0.20").compareTo(IrRegressivoCalculator.aliquota(181)));
        assertEquals(0, new BigDecimal("0.175").compareTo(IrRegressivoCalculator.aliquota(720)));
        assertEquals(0, new BigDecimal("0.15").compareTo(IrRegressivoCalculator.aliquota(721)));
    }

    private static AmortizacaoComparador.Entrada entrada(
            BigDecimal saldo,
            BigDecimal cet,
            BigDecimal alt,
            BigDecimal valorAmort,
            BigDecimal caixaLivre,
            BigDecimal reservaApos,
            BigDecimal piso,
            SistemaAmortizacao sistema,
            boolean contemplado) {
        return new AmortizacaoComparador.Entrada(
                sistema,
                saldo,
                cet,
                cet,
                180,
                new BigDecimal("8000"),
                BigDecimal.ZERO,
                LocalDate.of(2026, 8, 15),
                valorAmort,
                alt,
                AmortizacaoComparacao.ModalidadeAmortizacao.REDUZIR_PRAZO,
                contemplado,
                caixaLivre,
                reservaApos,
                piso);
    }
}
