package br.com.vilareal.patrimonio.api.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record TaxaReferenciaRequest(
        @NotNull BigDecimal taxaReferenciaLiquidaAa
) {
}
