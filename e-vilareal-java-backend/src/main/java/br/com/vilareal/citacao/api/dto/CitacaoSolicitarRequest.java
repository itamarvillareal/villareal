package br.com.vilareal.citacao.api.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public class CitacaoSolicitarRequest {

    @NotNull
    private Long processoParteId;

    @NotNull
    private Long pessoaEnderecoId;

    @NotNull
    private LocalDate dataSolicitacao;

    private String movProjudiSolicitacao;

    private Long andamentoSolicitacaoId;

    private String observacao;

    public Long getProcessoParteId() {
        return processoParteId;
    }

    public void setProcessoParteId(Long processoParteId) {
        this.processoParteId = processoParteId;
    }

    public Long getPessoaEnderecoId() {
        return pessoaEnderecoId;
    }

    public void setPessoaEnderecoId(Long pessoaEnderecoId) {
        this.pessoaEnderecoId = pessoaEnderecoId;
    }

    public LocalDate getDataSolicitacao() {
        return dataSolicitacao;
    }

    public void setDataSolicitacao(LocalDate dataSolicitacao) {
        this.dataSolicitacao = dataSolicitacao;
    }

    public String getMovProjudiSolicitacao() {
        return movProjudiSolicitacao;
    }

    public void setMovProjudiSolicitacao(String movProjudiSolicitacao) {
        this.movProjudiSolicitacao = movProjudiSolicitacao;
    }

    public Long getAndamentoSolicitacaoId() {
        return andamentoSolicitacaoId;
    }

    public void setAndamentoSolicitacaoId(Long andamentoSolicitacaoId) {
        this.andamentoSolicitacaoId = andamentoSolicitacaoId;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }
}
