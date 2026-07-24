package br.com.vilareal.patrimonio.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Registro a posteriori de amortização já executada na instituição financeira.
 * O sistema não executa — apenas persiste o fato consumado e recalcula o cronograma.
 */
public record AmortizacaoRegistroRequest(
        @NotNull Long passivoId,
        @NotNull @DecimalMin("0.01") BigDecimal valor,
        @NotBlank String modalidade,
        @NotNull LocalDate dataEfetivacao,
        @NotBlank String racional,
        String justificativaReserva,
        String justificativaTeto,
        BigDecimal retornoAlternativaLiquidaAa
) {
}
