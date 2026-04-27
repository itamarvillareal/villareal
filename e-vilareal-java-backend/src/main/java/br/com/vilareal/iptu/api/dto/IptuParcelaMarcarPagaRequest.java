package br.com.vilareal.iptu.api.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public class IptuParcelaMarcarPagaRequest {

    @NotNull
    private LocalDate dataPagamento;

    private Long pagamentoId;

    public LocalDate getDataPagamento() {
        return dataPagamento;
    }

    public void setDataPagamento(LocalDate dataPagamento) {
        this.dataPagamento = dataPagamento;
    }

    public Long getPagamentoId() {
        return pagamentoId;
    }

    public void setPagamentoId(Long pagamentoId) {
        this.pagamentoId = pagamentoId;
    }
}
