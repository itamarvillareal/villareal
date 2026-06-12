package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Upsert do saldo de abertura de uma conta bancária (ver V107). */
@Getter
@Setter
public class SaldoInicialBancoWriteRequest {

    @NotNull(message = "numeroBanco é obrigatório.")
    private Integer numeroBanco;

    private String bancoNome;

    @NotNull(message = "dataReferencia é obrigatória.")
    private LocalDate dataReferencia;

    @NotNull(message = "valor é obrigatório.")
    private BigDecimal valor;
}
