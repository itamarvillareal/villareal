package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class SaldoBancoResponse {

    private Integer numeroBanco;
    /** Soma assinada (crédito − débito) de todos os lançamentos do banco. */
    private BigDecimal saldo;
    private LocalDate dataUltimoLancamento;
    private long totalLancamentos;
}
