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
    /** Quando informada em GET saldo-banco?data=, data de referência do cálculo. */
    private LocalDate dataReferencia;
    /** Lançamentos com data_lancamento ≤ dataReferencia (só quando dataReferencia preenchida). */
    private Long lancamentosAteData;
    /** Soma assinada apenas no dia dataReferencia. */
    private BigDecimal movimentoNoDia;
    /** Quantidade de lançamentos no dia dataReferencia. */
    private Long lancamentosNoDia;
}
