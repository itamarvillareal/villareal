package br.com.vilareal.patrimonio.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record AmortizacaoSolicitacaoRequest(
        @NotNull Long passivoId,
        @NotNull @DecimalMin("0.01") BigDecimal valor,
        String modalidade,
        BigDecimal retornoAlternativaLiquidaAa,
        BigDecimal retornoAlternativaBrutaAa,
        @NotBlank String racional,
        String justificativaReserva,
        String justificativaTeto
) {
}
