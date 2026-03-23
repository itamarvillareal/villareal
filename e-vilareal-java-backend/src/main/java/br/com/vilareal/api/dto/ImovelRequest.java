package br.com.vilareal.api.dto;

import br.com.vilareal.api.entity.enums.ImovelSituacao;
import jakarta.validation.constraints.NotNull;

public class ImovelRequest {
    @NotNull
    private Long clienteId;
    private Long processoId;
    private String titulo;
    private String enderecoCompleto;
    private String condominio;
    private String unidade;
    private String tipoImovel;
    private ImovelSituacao situacao;
    private String garagens;
    private String inscricaoImobiliaria;
    private String observacoes;
    private String camposExtrasJson;
    private Boolean ativo;

    public Long getClienteId() { return clienteId; }
    public void setClienteId(Long clienteId) { this.clienteId = clienteId; }
    public Long getProcessoId() { return processoId; }
    public void setProcessoId(Long processoId) { this.processoId = processoId; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getEnderecoCompleto() { return enderecoCompleto; }
    public void setEnderecoCompleto(String enderecoCompleto) { this.enderecoCompleto = enderecoCompleto; }
    public String getCondominio() { return condominio; }
    public void setCondominio(String condominio) { this.condominio = condominio; }
    public String getUnidade() { return unidade; }
    public void setUnidade(String unidade) { this.unidade = unidade; }
    public String getTipoImovel() { return tipoImovel; }
    public void setTipoImovel(String tipoImovel) { this.tipoImovel = tipoImovel; }
    public ImovelSituacao getSituacao() { return situacao; }
    public void setSituacao(ImovelSituacao situacao) { this.situacao = situacao; }
    public String getGaragens() { return garagens; }
    public void setGaragens(String garagens) { this.garagens = garagens; }
    public String getInscricaoImobiliaria() { return inscricaoImobiliaria; }
    public void setInscricaoImobiliaria(String inscricaoImobiliaria) { this.inscricaoImobiliaria = inscricaoImobiliaria; }
    public String getObservacoes() { return observacoes; }
    public void setObservacoes(String observacoes) { this.observacoes = observacoes; }
    public String getCamposExtrasJson() { return camposExtrasJson; }
    public void setCamposExtrasJson(String camposExtrasJson) { this.camposExtrasJson = camposExtrasJson; }
    public Boolean getAtivo() { return ativo; }
    public void setAtivo(Boolean ativo) { this.ativo = ativo; }
}
