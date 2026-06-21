package br.com.vilareal.documento;

import jakarta.validation.constraints.NotNull;

public record ContratoHonorariosAprovarSugestaoRequest(
        @NotNull Long contratoId,
        @NotNull Integer numeroParcela,
        @NotNull Long financeiroLancamentoId) {}
