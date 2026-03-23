package br.com.vilareal.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class LancamentoFinanceiroResponse {
    private Long id;
    private Long contaContabilId;
    private String contaContabilNome;
    private Long classificacaoFinanceiraId;
    private String classificacaoFinanceiraNome;
    private Long eloFinanceiroId;
    private String eloFinanceiroCodigo;
    private Long clienteId;
    private Long processoId;
    private Long usuarioId;
    private String bancoNome;
    private Integer numeroBanco;
    private String numeroLancamento;
    private LocalDate dataLancamento;
    private LocalDate dataCompetencia;
    private String descricao;
    private String descricaoDetalhada;
    private String documentoReferencia;
    private BigDecimal valor;
    private String natureza;
    private String refTipo;
    private String eqReferencia;
    private String parcelaRef;
    private String status;
    private String origem;
    private String observacao;
    private String metadadosJson;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getContaContabilId() { return contaContabilId; }
    public void setContaContabilId(Long contaContabilId) { this.contaContabilId = contaContabilId; }
    public String getContaContabilNome() { return contaContabilNome; }
    public void setContaContabilNome(String contaContabilNome) { this.contaContabilNome = contaContabilNome; }
    public Long getClassificacaoFinanceiraId() { return classificacaoFinanceiraId; }
    public void setClassificacaoFinanceiraId(Long classificacaoFinanceiraId) { this.classificacaoFinanceiraId = classificacaoFinanceiraId; }
    public String getClassificacaoFinanceiraNome() { return classificacaoFinanceiraNome; }
    public void setClassificacaoFinanceiraNome(String classificacaoFinanceiraNome) { this.classificacaoFinanceiraNome = classificacaoFinanceiraNome; }
    public Long getEloFinanceiroId() { return eloFinanceiroId; }
    public void setEloFinanceiroId(Long eloFinanceiroId) { this.eloFinanceiroId = eloFinanceiroId; }
    public String getEloFinanceiroCodigo() { return eloFinanceiroCodigo; }
    public void setEloFinanceiroCodigo(String eloFinanceiroCodigo) { this.eloFinanceiroCodigo = eloFinanceiroCodigo; }
    public Long getClienteId() { return clienteId; }
    public void setClienteId(Long clienteId) { this.clienteId = clienteId; }
    public Long getProcessoId() { return processoId; }
    public void setProcessoId(Long processoId) { this.processoId = processoId; }
    public Long getUsuarioId() { return usuarioId; }
    public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }
    public String getBancoNome() { return bancoNome; }
    public void setBancoNome(String bancoNome) { this.bancoNome = bancoNome; }
    public Integer getNumeroBanco() { return numeroBanco; }
    public void setNumeroBanco(Integer numeroBanco) { this.numeroBanco = numeroBanco; }
    public String getNumeroLancamento() { return numeroLancamento; }
    public void setNumeroLancamento(String numeroLancamento) { this.numeroLancamento = numeroLancamento; }
    public LocalDate getDataLancamento() { return dataLancamento; }
    public void setDataLancamento(LocalDate dataLancamento) { this.dataLancamento = dataLancamento; }
    public LocalDate getDataCompetencia() { return dataCompetencia; }
    public void setDataCompetencia(LocalDate dataCompetencia) { this.dataCompetencia = dataCompetencia; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public String getDescricaoDetalhada() { return descricaoDetalhada; }
    public void setDescricaoDetalhada(String descricaoDetalhada) { this.descricaoDetalhada = descricaoDetalhada; }
    public String getDocumentoReferencia() { return documentoReferencia; }
    public void setDocumentoReferencia(String documentoReferencia) { this.documentoReferencia = documentoReferencia; }
    public BigDecimal getValor() { return valor; }
    public void setValor(BigDecimal valor) { this.valor = valor; }
    public String getNatureza() { return natureza; }
    public void setNatureza(String natureza) { this.natureza = natureza; }
    public String getRefTipo() { return refTipo; }
    public void setRefTipo(String refTipo) { this.refTipo = refTipo; }
    public String getEqReferencia() { return eqReferencia; }
    public void setEqReferencia(String eqReferencia) { this.eqReferencia = eqReferencia; }
    public String getParcelaRef() { return parcelaRef; }
    public void setParcelaRef(String parcelaRef) { this.parcelaRef = parcelaRef; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getOrigem() { return origem; }
    public void setOrigem(String origem) { this.origem = origem; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public String getMetadadosJson() { return metadadosJson; }
    public void setMetadadosJson(String metadadosJson) { this.metadadosJson = metadadosJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
