package br.com.vilareal.processo.api.dto;

import java.time.LocalDate;

public class ProcessoPrazoResponse {

    private Long id;
    private Long andamentoId;
    private String descricao;
    private LocalDate dataInicio;
    private LocalDate dataFim;
    private Boolean prazoFatal;
    private String status;
    private String observacao;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getAndamentoId() {
        return andamentoId;
    }

    public void setAndamentoId(Long andamentoId) {
        this.andamentoId = andamentoId;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public LocalDate getDataInicio() {
        return dataInicio;
    }

    public void setDataInicio(LocalDate dataInicio) {
        this.dataInicio = dataInicio;
    }

    public LocalDate getDataFim() {
        return dataFim;
    }

    public void setDataFim(LocalDate dataFim) {
        this.dataFim = dataFim;
    }

    public Boolean getPrazoFatal() {
        return prazoFatal;
    }

    public void setPrazoFatal(Boolean prazoFatal) {
        this.prazoFatal = prazoFatal;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }
}
