package br.com.vilareal.processo.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "Criar/atualizar processo (processosRepository.salvarCabecalhoProcesso)")
public class ProcessoWriteRequest {

    @NotNull
    private Long clienteId;

    @NotNull
    private Integer numeroInterno;

    /** Unidade (ex.: A-0103); opcional. */
    private String unidade;

    /** Pasta do processo (rótulo da planilha); opcional. */
    private String pasta;

    private String numeroCnj;
    private String numeroProcessoAntigo;
    private String naturezaAcao;
    private String descricaoAcao;
    private String competencia;
    private String fase;
    private String observacaoFase;
    private String tramitacao;
    private LocalDate dataProtocolo;
    private LocalDate prazoFatal;
    private LocalDate proximaConsulta;
    private String observacao;
    private BigDecimal valorCausa;
    private String uf;
    private String cidade;
    private Boolean consultaAutomatica;
    private Boolean ativo;
    private String consultor;
    private Long usuarioResponsavelId;

    /** UUID da importação em lote; opcional. */
    private String importacaoId;

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
    }

    public Integer getNumeroInterno() {
        return numeroInterno;
    }

    public void setNumeroInterno(Integer numeroInterno) {
        this.numeroInterno = numeroInterno;
    }

    public String getUnidade() {
        return unidade;
    }

    public void setUnidade(String unidade) {
        this.unidade = unidade;
    }

    public String getPasta() {
        return pasta;
    }

    public void setPasta(String pasta) {
        this.pasta = pasta;
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

    public String getImportacaoId() {
        return importacaoId;
    }

    public void setImportacaoId(String importacaoId) {
        this.importacaoId = importacaoId;
    }
}
