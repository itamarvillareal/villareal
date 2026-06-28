package br.com.vilareal.imovel.api.dto;

import br.com.vilareal.localidade.api.dto.MunicipioResumoResponse;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Imóvel — paridade imoveisRepository.mapApiToUi")
public class ImovelResponse {

    private Long id;
    @Schema(description = "PK da tabela cliente")
    private Long clienteId;
    @Schema(description = "pessoa.id vinculada ao imóvel (legado)")
    private Long pessoaRefId;
    /** Código de 8 dígitos (col. B da planilha canónica), quando houver cliente vinculado. */
    private String codigoCliente;
    private Long processoId;
    /** Nº interno do processo (col. C da planilha canónica), quando houver processo vinculado. */
    private Integer numeroInternoProcesso;
    private Integer numeroPlanilha;
    private Long responsavelPessoaId;
    private String titulo;
    private String enderecoCompleto;
    private Integer municipioId;
    private MunicipioResumoResponse municipio;
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

    public Long getPessoaRefId() {
        return pessoaRefId;
    }

    public void setPessoaRefId(Long pessoaRefId) {
        this.pessoaRefId = pessoaRefId;
    }

    public String getCodigoCliente() {
        return codigoCliente;
    }

    public void setCodigoCliente(String codigoCliente) {
        this.codigoCliente = codigoCliente;
    }

    public Long getProcessoId() {
        return processoId;
    }

    public void setProcessoId(Long processoId) {
        this.processoId = processoId;
    }

    public Integer getNumeroInternoProcesso() {
        return numeroInternoProcesso;
    }

    public void setNumeroInternoProcesso(Integer numeroInternoProcesso) {
        this.numeroInternoProcesso = numeroInternoProcesso;
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

    public Integer getMunicipioId() {
        return municipioId;
    }

    public void setMunicipioId(Integer municipioId) {
        this.municipioId = municipioId;
    }

    public MunicipioResumoResponse getMunicipio() {
        return municipio;
    }

    public void setMunicipio(MunicipioResumoResponse municipio) {
        this.municipio = municipio;
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
