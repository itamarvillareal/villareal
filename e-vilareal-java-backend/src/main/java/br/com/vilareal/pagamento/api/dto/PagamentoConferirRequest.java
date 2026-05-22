package br.com.vilareal.pagamento.api.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class PagamentoConferirRequest {

    private Long financeiroLancamentoId;

    @NotNull
    private BigDecimal valorPagoBanco;

    private String observacao;

    public Long getFinanceiroLancamentoId() {
        return financeiroLancamentoId;
    }

    public void setFinanceiroLancamentoId(Long financeiroLancamentoId) {
        this.financeiroLancamentoId = financeiroLancamentoId;
    }

    public BigDecimal getValorPagoBanco() {
        return valorPagoBanco;
    }

    public void setValorPagoBanco(BigDecimal valorPagoBanco) {
        this.valorPagoBanco = valorPagoBanco;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }
}
