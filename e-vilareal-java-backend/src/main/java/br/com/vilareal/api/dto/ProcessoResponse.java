package br.com.vilareal.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class ProcessoResponse {
    private Long id;
    private Long clienteId;
    private String codigoCliente;
    private Integer numeroInterno;
    private String numeroCnj;
    private String numeroProcessoAntigo;
    private String descricaoAcao;
    private String naturezaAcao;
    private String competencia;
    private String fase;
    private String status;
    private String tramitacao;
    private LocalDate dataProtocolo;
    private LocalDate prazoFatal;
    private LocalDate proximaConsulta;
    private String observacao;
    private BigDecimal valorCausa;
    private String uf;
    private String cidade;
    private String comarca;
    private String vara;
    private String tribunal;
    private Boolean consultaAutomatica;
    private Boolean ativo;
    private Long usuarioResponsavelId;
    private String consultor;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getClienteId() { return clienteId; }
    public void setClienteId(Long clienteId) { this.clienteId = clienteId; }
    public String getCodigoCliente() { return codigoCliente; }
    public void setCodigoCliente(String codigoCliente) { this.codigoCliente = codigoCliente; }
    public Integer getNumeroInterno() { return numeroInterno; }
    public void setNumeroInterno(Integer numeroInterno) { this.numeroInterno = numeroInterno; }
    public String getNumeroCnj() { return numeroCnj; }
    public void setNumeroCnj(String numeroCnj) { this.numeroCnj = numeroCnj; }
    public String getNumeroProcessoAntigo() { return numeroProcessoAntigo; }
    public void setNumeroProcessoAntigo(String numeroProcessoAntigo) { this.numeroProcessoAntigo = numeroProcessoAntigo; }
    public String getDescricaoAcao() { return descricaoAcao; }
    public void setDescricaoAcao(String descricaoAcao) { this.descricaoAcao = descricaoAcao; }
    public String getNaturezaAcao() { return naturezaAcao; }
    public void setNaturezaAcao(String naturezaAcao) { this.naturezaAcao = naturezaAcao; }
    public String getCompetencia() { return competencia; }
    public void setCompetencia(String competencia) { this.competencia = competencia; }
    public String getFase() { return fase; }
    public void setFase(String fase) { this.fase = fase; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTramitacao() { return tramitacao; }
    public void setTramitacao(String tramitacao) { this.tramitacao = tramitacao; }
    public LocalDate getDataProtocolo() { return dataProtocolo; }
    public void setDataProtocolo(LocalDate dataProtocolo) { this.dataProtocolo = dataProtocolo; }
    public LocalDate getPrazoFatal() { return prazoFatal; }
    public void setPrazoFatal(LocalDate prazoFatal) { this.prazoFatal = prazoFatal; }
    public LocalDate getProximaConsulta() { return proximaConsulta; }
    public void setProximaConsulta(LocalDate proximaConsulta) { this.proximaConsulta = proximaConsulta; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public BigDecimal getValorCausa() { return valorCausa; }
    public void setValorCausa(BigDecimal valorCausa) { this.valorCausa = valorCausa; }
    public String getUf() { return uf; }
    public void setUf(String uf) { this.uf = uf; }
    public String getCidade() { return cidade; }
    public void setCidade(String cidade) { this.cidade = cidade; }
    public String getComarca() { return comarca; }
    public void setComarca(String comarca) { this.comarca = comarca; }
    public String getVara() { return vara; }
    public void setVara(String vara) { this.vara = vara; }
    public String getTribunal() { return tribunal; }
    public void setTribunal(String tribunal) { this.tribunal = tribunal; }
    public Boolean getConsultaAutomatica() { return consultaAutomatica; }
    public void setConsultaAutomatica(Boolean consultaAutomatica) { this.consultaAutomatica = consultaAutomatica; }
    public Boolean getAtivo() { return ativo; }
    public void setAtivo(Boolean ativo) { this.ativo = ativo; }
    public Long getUsuarioResponsavelId() { return usuarioResponsavelId; }
    public void setUsuarioResponsavelId(Long usuarioResponsavelId) { this.usuarioResponsavelId = usuarioResponsavelId; }
    public String getConsultor() { return consultor; }
    public void setConsultor(String consultor) { this.consultor = consultor; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
