package br.com.vilareal.patrimonio.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record AmortizacaoSimulacaoRequest(
        @NotNull Long passivoId,
        @NotNull @DecimalMin("0.01") BigDecimal valor,
        String modalidade,
        BigDecimal retornoAlternativaLiquidaAa,
        /** Se informado, aplica IR regressivo com horizonte = prazo remanescente da dívida. */
        BigDecimal retornoAlternativaBrutaAa,
        BigDecimal inflacaoProjetadaAa,
        Boolean cetJaProjetado
) {
}
