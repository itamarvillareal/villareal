package br.com.vilareal.pagamento.api.dto;

import jakarta.validation.constraints.NotNull;

public class PagamentoConciliacaoDesvincularRequest {

    @NotNull
    private Long pagamentoId;

    public Long getPagamentoId() {
        return pagamentoId;
    }

    public void setPagamentoId(Long pagamentoId) {
        this.pagamentoId = pagamentoId;
    }
}
