package br.com.vilareal.imovel.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Imóvel — paridade imoveisRepository.mapApiToUi")
public class ImovelResponse {

    private Long id;
    /** {@code pessoa.id} quando houver cliente vinculado; {@code null} se imóvel sem cliente (ex.: import planilha). */
    private Long clienteId;
    private Long processoId;
    private Integer numeroPlanilha;
    private Long responsavelPessoaId;
    private String titulo;
    private String enderecoCompleto;
    private String condominio;
    private String unidade;
    private String tipoImovel;
    private String situacao;
    private String garagens;
    private String inscricaoImobiliaria;
    private String observacoes;
    private String camposExtrasJson;
    private Boolean ativo;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
    }

    public Long getProcessoId() {
        return processoId;
    }

    public void setProcessoId(Long processoId) {
        this.processoId = processoId;
    }

    public Integer getNumeroPlanilha() {
        return numeroPlanilha;
    }

    public void setNumeroPlanilha(Integer numeroPlanilha) {
        this.numeroPlanilha = numeroPlanilha;
    }

    public Long getResponsavelPessoaId() {
        return responsavelPessoaId;
    }

    public void setResponsavelPessoaId(Long responsavelPessoaId) {
        this.responsavelPessoaId = responsavelPessoaId;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getEnderecoCompleto() {
        return enderecoCompleto;
    }

    public void setEnderecoCompleto(String enderecoCompleto) {
        this.enderecoCompleto = enderecoCompleto;
    }

    public String getCondominio() {
        return condominio;
    }

    public void setCondominio(String condominio) {
        this.condominio = condominio;
    }

    public String getUnidade() {
        return unidade;
    }

    public void setUnidade(String unidade) {
        this.unidade = unidade;
    }

    public String getTipoImovel() {
        return tipoImovel;
    }

    public void setTipoImovel(String tipoImovel) {
        this.tipoImovel = tipoImovel;
    }

    public String getSituacao() {
        return situacao;
    }

    public void setSituacao(String situacao) {
        this.situacao = situacao;
    }

    public String getGaragens() {
        return garagens;
    }

    public void setGaragens(String garagens) {
        this.garagens = garagens;
    }

    public String getInscricaoImobiliaria() {
        return inscricaoImobiliaria;
    }

    public void setInscricaoImobiliaria(String inscricaoImobiliaria) {
        this.inscricaoImobiliaria = inscricaoImobiliaria;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
    }

    public String getCamposExtrasJson() {
        return camposExtrasJson;
    }

    public void setCamposExtrasJson(String camposExtrasJson) {
        this.camposExtrasJson = camposExtrasJson;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }
}
