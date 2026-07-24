package br.com.vilareal.patrimonio.domain.finance;

import java.math.BigDecimal;
import java.util.List;

/**
 * Resultado do comparador amortizar vs. investir.
 * Sempre inclui nominal eliminado E economia em VP — nunca só "meses eliminados".
 */
public record AmortizacaoComparacao(
        BigDecimal cetDividaAa,
        BigDecimal retornoAlternativaLiquidaAa,
        BigDecimal diferencialPpAa,
        BigDecimal valorAmortizacao,
        int mesesEliminados,
        BigDecimal valorNominalEliminado,
        BigDecimal economiaValorPresente,
        BigDecimal taxaImplicitaAa,
        BigDecimal impactoPl12m,
        BigDecimal impactoPl36m,
        ModalidadeAmortizacao modalidade,
        RecomendacaoAmortizacao recomendacao,
        String explicacao,
        boolean consorcio,
        boolean contemplado,
        List<ParcelaCronograma> parcelasEliminadas,
        String baseComparacao,
        String avisoBase,
        Integer horizonteComparacaoDias,
        BigDecimal aliquotaIrAlternativa
) {
    public enum ModalidadeAmortizacao {
        REDUZIR_PRAZO,
        REDUZIR_PARCELA
    }
}
