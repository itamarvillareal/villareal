package br.com.vilareal.processo.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;

public class ProcessoResponse {

    private Long id;
    private Long clienteId;
    private String codigoCliente;
    private Integer numeroInterno;
    private String numeroCnj;
    private String numeroProcessoAntigo;
    private String naturezaAcao;
    private String descricaoAcao;
    private String competencia;
    private String fase;
    private String observacaoFase;
    private String status;
    private String tramitacao;
    private LocalDate dataProtocolo;
    private LocalDate prazoFatal;
    private LocalDate proximaConsulta;
    private String observacao;
    private BigDecimal valorCausa;
    private String uf;
    private String cidade;
    /** Unidade condominial (ex.: A-0103). */
    private String unidade;
    private Boolean consultaAutomatica;
    private Boolean ativo;
    private String consultor;
    private Long usuarioResponsavelId;

    /**
     * Nomes da parte oposta (polo ≠ autor/requerente/cliente), no mesmo critério da tela Processos —
     * ex.: "NET ANÁPOLIS LTDA e OUTRA"; só preenchido em {@code GET /api/processos?codigoCliente=}.
     */
    private String parteOposta;

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

    /** Id em {@code pessoa} (coluna B); espelha {@code clienteId} para alinhar com GET /api/clientes ({@code id}/{@code pessoaId}). */
    @Schema(description = "Id da pessoa (FK processo.pessoa_id); igual a clienteId")
    public Long getPessoaId() {
        return clienteId;
    }

    public String getCodigoCliente() {
        return codigoCliente;
    }

    public void setCodigoCliente(String codigoCliente) {
        this.codigoCliente = codigoCliente;
    }

    public Integer getNumeroInterno() {
        return numeroInterno;
    }

    public void setNumeroInterno(Integer numeroInterno) {
        this.numeroInterno = numeroInterno;
    }

    public String getNumeroCnj() {
        return numeroCnj;
    }

    public void setNumeroCnj(String numeroCnj) {
        this.numeroCnj = numeroCnj;
    }

    public String getNumeroProcessoAntigo() {
        return numeroProcessoAntigo;
    }

    public void setNumeroProcessoAntigo(String numeroProcessoAntigo) {
        this.numeroProcessoAntigo = numeroProcessoAntigo;
    }

    public String getNaturezaAcao() {
        return naturezaAcao;
    }

    public void setNaturezaAcao(String naturezaAcao) {
        this.naturezaAcao = naturezaAcao;
    }

    public String getDescricaoAcao() {
        return descricaoAcao;
    }

    public void setDescricaoAcao(String descricaoAcao) {
        this.descricaoAcao = descricaoAcao;
    }

    public String getCompetencia() {
        return competencia;
    }

    public void setCompetencia(String competencia) {
        this.competencia = competencia;
    }

    public String getFase() {
        return fase;
    }

    public void setFase(String fase) {
        this.fase = fase;
    }

    public String getObservacaoFase() {
        return observacaoFase;
    }

    public void setObservacaoFase(String observacaoFase) {
        this.observacaoFase = observacaoFase;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getTramitacao() {
        return tramitacao;
    }

    public void setTramitacao(String tramitacao) {
        this.tramitacao = tramitacao;
    }

    public LocalDate getDataProtocolo() {
        return dataProtocolo;
    }

    public void setDataProtocolo(LocalDate dataProtocolo) {
        this.dataProtocolo = dataProtocolo;
    }

    public LocalDate getPrazoFatal() {
        return prazoFatal;
    }

    public void setPrazoFatal(LocalDate prazoFatal) {
        this.prazoFatal = prazoFatal;
    }

    public LocalDate getProximaConsulta() {
        return proximaConsulta;
    }

    public void setProximaConsulta(LocalDate proximaConsulta) {
        this.proximaConsulta = proximaConsulta;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }

    public BigDecimal getValorCausa() {
        return valorCausa;
    }

    public void setValorCausa(BigDecimal valorCausa) {
        this.valorCausa = valorCausa;
    }

    public String getUf() {
        return uf;
    }

    public void setUf(String uf) {
        this.uf = uf;
    }

    public String getCidade() {
        return cidade;
    }

    public void setCidade(String cidade) {
        this.cidade = cidade;
    }

    public String getUnidade() {
        return unidade;
    }

    public void setUnidade(String unidade) {
        this.unidade = unidade;
    }

    public Boolean getConsultaAutomatica() {
        return consultaAutomatica;
    }

    public void setConsultaAutomatica(Boolean consultaAutomatica) {
        this.consultaAutomatica = consultaAutomatica;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public String getConsultor() {
        return consultor;
    }

    public void setConsultor(String consultor) {
        this.consultor = consultor;
    }

    public Long getUsuarioResponsavelId() {
        return usuarioResponsavelId;
    }

    public void setUsuarioResponsavelId(Long usuarioResponsavelId) {
        this.usuarioResponsavelId = usuarioResponsavelId;
    }

    public String getParteOposta() {
        return parteOposta;
    }

    public void setParteOposta(String parteOposta) {
        this.parteOposta = parteOposta;
    }
}
