package br.com.vilareal.pagamento.api.dto;

import jakarta.validation.constraints.NotNull;

public class PagamentoConciliacaoVincularRequest {

    @NotNull
    private Long pagamentoId;

    @NotNull
    private Long financeiroLancamentoId;

    public Long getPagamentoId() {
        return pagamentoId;
    }

    public void setPagamentoId(Long pagamentoId) {
        this.pagamentoId = pagamentoId;
    }

    public Long getFinanceiroLancamentoId() {
        return financeiroLancamentoId;
    }

    public void setFinanceiroLancamentoId(Long financeiroLancamentoId) {
        this.financeiroLancamentoId = financeiroLancamentoId;
    }
}
