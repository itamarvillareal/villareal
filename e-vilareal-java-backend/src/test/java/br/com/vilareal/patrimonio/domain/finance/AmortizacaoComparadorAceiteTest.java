package br.com.vilareal.patrimonio.domain.finance;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Casos de aceite do briefing §10 — motor de decisão.
 */
class AmortizacaoComparadorAceiteTest {

    @Test
    void caso1_amortizacaoFavoravel_recomendaAmortizar() {
        // CET 13% vs RF líquida 10,2% → diferencial +2,8 p.p.
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

    @Test
    void caso2_amortizacaoDesfavoravel_desaconselha() {
        // CET 8,5% vs RF 10,2% → diferencial −1,7 p.p.
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
        assertTrue(r.diferencialPpAa().compareTo(BigDecimal.ZERO) < 0);
        assertTrue(r.explicacao().toLowerCase().contains("destr")
                || r.explicacao().toLowerCase().contains("abaixo"));
    }

    @Test
    void caso3_armadilhaMesesEliminados_exibeVpETaxaImplicita() {
        // Parcela ~8k eliminando ~23 meses do final — o ganho NÃO é 23×.
        List<ParcelaCronograma> cronograma = CronogramaAmortizacaoCalculator.gerar(
                SistemaAmortizacao.PRICE,
                new BigDecimal("300000"),
                MoneyMath.percentToDecimal(new BigDecimal("10")),
                180,
                LocalDate.of(2026, 8, 15),
                BigDecimal.ZERO);

        // Amortiza 1 parcela cheia tipicamente elimina várias do final
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

        assertTrue(r.mesesEliminados() > 0, "deve eliminar meses do final");
        assertTrue(r.valorNominalEliminado().compareTo(BigDecimal.ZERO) > 0);
        assertTrue(r.economiaValorPresente().compareTo(r.valorNominalEliminado()) < 0,
                "economia VP deve ser fração do nominal eliminado");
        assertTrue(r.explicacao().contains("valor presente"));
        assertTrue(r.explicacao().contains("taxa implícita") || r.explicacao().contains("implicita")
                || r.taxaImplicitaAa() != null);

        // Sanity do cronograma gerado
        assertEquals(180, cronograma.size());
        // Últimas parcelas Price: amortização >> juros
        ParcelaCronograma ultima = cronograma.get(cronograma.size() - 1);
        ParcelaCronograma primeira = cronograma.get(0);
        assertTrue(ultima.juros().compareTo(primeira.juros()) < 0);
    }

    @Test
    void caso4_conflitoLiquidez_bloqueiaAcimaDoCaixaLivre() {
        // Caixa 60k, vinculado 45k → livre 15k; amortizar 20k deve bloquear
        AmortizacaoComparacao r = AmortizacaoComparador.comparar(entrada(
                new BigDecimal("300000"),
                new BigDecimal("13"),
                new BigDecimal("10.2"),
                new BigDecimal("20000"),
                new BigDecimal("15000"),
                new BigDecimal("100000"),
                new BigDecimal("50000"),
                SistemaAmortizacao.PRICE,
                false));

        assertEquals(RecomendacaoAmortizacao.BLOQUEADO_LIQUIDEZ, r.recomendacao());
        assertTrue(r.explicacao().toLowerCase().contains("caixa livre")
                || r.explicacao().toLowerCase().contains("vinculado"));
    }

    @Test
    void caso5_consorcioNaoContemplado_naoAplicaLogicaFinanciamento() {
        AmortizacaoComparacao r = AmortizacaoComparador.comparar(entrada(
                new BigDecimal("100000"),
                new BigDecimal("0"),
                new BigDecimal("10.2"),
                new BigDecimal("5000"),
                new BigDecimal("50000"),
                new BigDecimal("100000"),
                new BigDecimal("50000"),
                SistemaAmortizacao.CONSORCIO,
                false));

        assertEquals(RecomendacaoAmortizacao.CONSORCIO_NAO_APLICA_JUROS, r.recomendacao());
        assertTrue(r.consorcio());
        assertTrue(r.explicacao().toLowerCase().contains("não contemplado")
                || r.explicacao().toLowerCase().contains("nao contemplado")
                || r.explicacao().contains("NÃO CONTEMPLADO"));
        assertEquals(0, MoneyMath.ZERO.compareTo(r.economiaValorPresente()));
    }

    @Test
    void price_parcelaConhecida() {
        // PV 100_000, 12% a.a., 12 meses — PMT calculável
        BigDecimal taxaMensal = MoneyMath.taxaMensalDeAnual(MoneyMath.percentToDecimal(new BigDecimal("12")));
        BigDecimal pmt = CronogramaAmortizacaoCalculator.parcelaPrice(
                new BigDecimal("100000"), taxaMensal, 12);
        assertTrue(pmt.compareTo(new BigDecimal("8800")) > 0);
        assertTrue(pmt.compareTo(new BigDecimal("9000")) < 0);

        List<ParcelaCronograma> cronograma = CronogramaAmortizacaoCalculator.gerar(
                SistemaAmortizacao.PRICE,
                new BigDecimal("100000"),
                MoneyMath.percentToDecimal(new BigDecimal("12")),
                12,
                LocalDate.of(2026, 1, 10),
                BigDecimal.ZERO);
        BigDecimal saldoFinal = cronograma.get(cronograma.size() - 1).saldoApos();
        assertEquals(0, MoneyMath.ZERO.compareTo(saldoFinal));
    }

    @Test
    void sac_amortizacaoConstante() {
        List<ParcelaCronograma> cronograma = CronogramaAmortizacaoCalculator.gerar(
                SistemaAmortizacao.SAC,
                new BigDecimal("120000"),
                MoneyMath.percentToDecimal(new BigDecimal("12")),
                12,
                LocalDate.of(2026, 1, 10),
                BigDecimal.ZERO);
        assertEquals(0, new BigDecimal("10000.00").compareTo(cronograma.get(0).amortizacao()));
        assertTrue(cronograma.get(0).valorParcela().compareTo(cronograma.get(11).valorParcela()) > 0);
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
