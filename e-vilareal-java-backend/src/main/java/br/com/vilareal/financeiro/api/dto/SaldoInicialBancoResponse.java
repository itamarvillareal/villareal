package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Saldo de abertura de uma conta bancária (ver V107). */
@Getter
@Setter
public class SaldoInicialBancoResponse {

    private Integer numeroBanco;
    private String bancoNome;
    /** Saldo de abertura é o saldo ao final desta data (véspera do extrato). */
    private LocalDate dataReferencia;
    /** Saldo assinado (pode ser negativo). */
    private BigDecimal valor;
}
