package br.com.vilareal.patrimonio.api.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record AmortizacaoComparacaoResponse(
        Long passivoId,
        String credor,
        BigDecimal cetDividaAa,
        BigDecimal retornoAlternativaLiquidaAa,
        BigDecimal diferencialPpAa,
        BigDecimal valorAmortizacao,
        Integer mesesEliminados,
        BigDecimal valorNominalEliminado,
        BigDecimal economiaValorPresente,
        BigDecimal taxaImplicitaAa,
        BigDecimal impactoPl12m,
        BigDecimal impactoPl36m,
        String modalidade,
        String recomendacao,
        String explicacao,
        boolean consorcio,
        boolean contemplado,
        BigDecimal caixaLivre,
        BigDecimal reservaAtual,
        BigDecimal pisoReserva,
        BigDecimal rendaFixaTotal,
        BigDecimal reservaEmergenciaLiquida,
        String baseComparacao,
        String avisoBase,
        Integer horizonteComparacaoDias,
        BigDecimal aliquotaIrAlternativa,
        BigDecimal tetoAmortizacaoAnual,
        BigDecimal tetoAmortizacaoUsadoAno,
        BigDecimal tetoAmortizacaoDisponivel,
        boolean ultrapassaTetoComEstaOperacao,
        Instant taxaReferenciaAtualizadaEm,
        boolean taxaReferenciaDesatualizada
) {
}
