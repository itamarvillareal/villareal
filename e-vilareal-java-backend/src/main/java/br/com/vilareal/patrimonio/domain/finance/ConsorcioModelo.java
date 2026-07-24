package br.com.vilareal.patrimonio.domain.finance;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Consórcio NÃO é financiamento. Lógicas distintas:
 * <ul>
 *   <li>Não contemplado: antecipar parcelas geralmente não reduz taxa de administração total;
 *       pode servir como lance. Não há juros a economizar.</li>
 *   <li>Contemplado: saldo funciona como dívida corrigida — comparação com investimentos
 *       volta a fazer sentido (delegada ao {@link AmortizacaoComparador}).</li>
 * </ul>
 */
public final class ConsorcioModelo {

    private ConsorcioModelo() {
    }

    public static AmortizacaoComparacao analisarAntecipacaoNaoContemplado(
            AmortizacaoComparador.Entrada e,
            BaseComparacaoTaxas.Resultado bases,
            Integer horizonteDias,
            BigDecimal aliquotaIr) {
        BigDecimal taxaAdminRestante = estimarTaxaAdminRemanescente(e);
        String explicacao = String.format(
                "Consórcio NÃO CONTEMPLADO: não há juros a economizar. "
                        + "Antecipar R$ %s pode acelerar contemplação (lance) mas tipicamente NÃO reduz "
                        + "o custo total de administração (estimativa remanescente R$ %s). "
                        + "Não aplicar lógica de desconto por antecipação de financiamento. "
                        + "Campos de economia de juros permanecem zerados.",
                MoneyMath.money(e.valorAmortizar()).toPlainString(),
                taxaAdminRestante.toPlainString());

        return new AmortizacaoComparacao(
                e.cetEfetivoAaPercent() != null ? e.cetEfetivoAaPercent() : BigDecimal.ZERO,
                e.retornoAlternativaLiquidaAaPercent(),
                BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP),
                MoneyMath.money(e.valorAmortizar()),
                0,
                MoneyMath.money(e.valorAmortizar()),
                MoneyMath.ZERO, // economia de juros = 0 (não há juros)
                BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP),
                MoneyMath.ZERO,
                MoneyMath.ZERO,
                e.modalidade(),
                RecomendacaoAmortizacao.CONSORCIO_NAO_APLICA_JUROS,
                explicacao,
                true,
                false,
                List.of(),
                bases != null ? bases.base() : "N/A",
                "Consórcio não contemplado — sem base de juros",
                horizonteDias,
                aliquotaIr != null ? aliquotaIr.multiply(MoneyMath.HUNDRED).setScale(2, RoundingMode.HALF_UP) : null);
    }

    static BigDecimal estimarTaxaAdminRemanescente(AmortizacaoComparador.Entrada e) {
        BigDecimal mensal = e.segurosTaxasMensais() != null ? e.segurosTaxasMensais() : BigDecimal.ZERO;
        return MoneyMath.money(mensal.multiply(BigDecimal.valueOf(Math.max(e.prazoRemanescenteMeses(), 0))));
    }
}
