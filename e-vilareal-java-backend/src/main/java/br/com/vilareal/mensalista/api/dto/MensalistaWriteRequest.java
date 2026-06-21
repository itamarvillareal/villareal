package br.com.vilareal.mensalista.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MensalistaWriteRequest(
        @NotNull Long clienteId,
        @NotNull @DecimalMin("0.01") BigDecimal valor,
        @NotNull @Min(1) @Max(31) Integer diaVencimento,
        @NotNull LocalDate dataInicio,
        LocalDate dataFim,
        @NotNull Boolean ativo) {}
