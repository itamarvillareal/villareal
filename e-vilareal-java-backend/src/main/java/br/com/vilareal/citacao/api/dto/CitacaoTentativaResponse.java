package br.com.vilareal.citacao.api.dto;

import br.com.vilareal.pessoa.api.dto.PessoaEnderecoItemResponse;

import java.time.LocalDate;

public class CitacaoTentativaResponse {

    private Long id;
    private Long processoParteId;
    private Long pessoaEnderecoId;
    private String status;
    private LocalDate dataSolicitacao;
    private Long andamentoSolicitacaoId;
    private String movProjudiSolicitacao;
    private Long movMonitoradaSolicitacaoId;
    private LocalDate dataRetorno;
    private Long andamentoRetornoId;
    private String movProjudiRetorno;
    private Long movMonitoradaRetornoId;
    private String motivoRetorno;
    private String observacao;
    private Long usuarioId;
    private PessoaEnderecoItemResponse endereco;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDate getDataSolicitacao() {
        return dataSolicitacao;
    }

    public void setDataSolicitacao(LocalDate dataSolicitacao) {
        this.dataSolicitacao = dataSolicitacao;
    }

    public Long getAndamentoSolicitacaoId() {
        return andamentoSolicitacaoId;
    }

    public void setAndamentoSolicitacaoId(Long andamentoSolicitacaoId) {
        this.andamentoSolicitacaoId = andamentoSolicitacaoId;
    }

    public String getMovProjudiSolicitacao() {
        return movProjudiSolicitacao;
    }

    public void setMovProjudiSolicitacao(String movProjudiSolicitacao) {
        this.movProjudiSolicitacao = movProjudiSolicitacao;
    }

    public Long getMovMonitoradaSolicitacaoId() {
        return movMonitoradaSolicitacaoId;
    }

    public void setMovMonitoradaSolicitacaoId(Long movMonitoradaSolicitacaoId) {
        this.movMonitoradaSolicitacaoId = movMonitoradaSolicitacaoId;
    }

    public LocalDate getDataRetorno() {
        return dataRetorno;
    }

    public void setDataRetorno(LocalDate dataRetorno) {
        this.dataRetorno = dataRetorno;
    }

    public Long getAndamentoRetornoId() {
        return andamentoRetornoId;
    }

    public void setAndamentoRetornoId(Long andamentoRetornoId) {
        this.andamentoRetornoId = andamentoRetornoId;
    }

    public String getMovProjudiRetorno() {
        return movProjudiRetorno;
    }

    public void setMovProjudiRetorno(String movProjudiRetorno) {
        this.movProjudiRetorno = movProjudiRetorno;
    }

    public Long getMovMonitoradaRetornoId() {
        return movMonitoradaRetornoId;
    }

    public void setMovMonitoradaRetornoId(Long movMonitoradaRetornoId) {
        this.movMonitoradaRetornoId = movMonitoradaRetornoId;
    }

    public String getMotivoRetorno() {
        return motivoRetorno;
    }

    public void setMotivoRetorno(String motivoRetorno) {
        this.motivoRetorno = motivoRetorno;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }

    public PessoaEnderecoItemResponse getEndereco() {
        return endereco;
    }

    public void setEndereco(PessoaEnderecoItemResponse endereco) {
        this.endereco = endereco;
    }
}
