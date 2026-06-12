package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class SaldoBancoResponse {

    private Integer numeroBanco;
    /** Soma assinada (crédito − débito) dos lançamentos do banco MAIS o saldo de abertura. */
    private BigDecimal saldo;
    /** Saldo de abertura informado pelo usuário aplicado ao cálculo (0 quando não há). */
    private BigDecimal saldoInicial;
    private LocalDate dataUltimoLancamento;
    private long totalLancamentos;
    /** Quando informada em GET saldo-banco?data=, data de referência do cálculo. */
    private LocalDate dataReferencia;
    /** Lançamentos com data_lancamento ≤ dataReferencia (só quando dataReferencia preenchida). */
    private Long lancamentosAteData;
    /** Soma assinada apenas no dia dataReferencia. */
    private BigDecimal movimentoNoDia;
    /** Quantidade de lançamentos no dia dataReferencia. */
    private Long lancamentosNoDia;
}
