package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Cadastro explícito de conta bancária (extrato/manual/virtual) via API.
 * Complementa o auto-provisionamento em {@link br.com.vilareal.financeiro.application.ContaBancariaResolverService}.
 */
public record ContaBancariaWriteRequest(
        @NotNull(message = "numeroBanco é obrigatório.") Integer numeroBanco,
        @NotBlank(message = "bancoNome é obrigatório.") @Size(max = 120) String bancoNome,
        @Pattern(regexp = "REAL|MANUAL|VIRTUAL", message = "tipo deve ser REAL, MANUAL ou VIRTUAL.") String tipo,
        Boolean temExtrato,
        Boolean ativo,
        @Size(max = 10) String ofxBankId,
        @Size(max = 20) String ofxAgencia,
        @Size(max = 30) String ofxConta) {
}
