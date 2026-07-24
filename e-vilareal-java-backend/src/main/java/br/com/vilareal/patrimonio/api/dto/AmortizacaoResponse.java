package br.com.vilareal.patrimonio.api.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record AmortizacaoResponse(
        Long id,
        Long passivoId,
        Instant dataSolicitacao,
        Instant dataEfetivacao,
        BigDecimal valor,
        String modalidade,
        String status,
        String origem,
        String racional,
        BigDecimal cetVigenteAa,
        BigDecimal retornoAlternativaAa,
        BigDecimal diferencialPp,
        BigDecimal economiaVp,
        BigDecimal valorNominalEliminado,
        Integer mesesEliminados,
        BigDecimal taxaImplicitaAa,
        BigDecimal impactoPl12m,
        BigDecimal impactoPl36m,
        String recomendacao,
        Instant pendenteAte,
        boolean ultrapassouTeto,
        String explicacaoGovernanca
) {
}
