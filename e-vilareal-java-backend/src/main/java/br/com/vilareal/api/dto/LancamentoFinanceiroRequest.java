package br.com.vilareal.api.dto;

import br.com.vilareal.api.entity.enums.LancamentoNatureza;
import br.com.vilareal.api.entity.enums.LancamentoOrigem;
import br.com.vilareal.api.entity.enums.LancamentoStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public class LancamentoFinanceiroRequest {
    @NotNull
    private Long contaContabilId;
    private Long classificacaoFinanceiraId;
    private Long eloFinanceiroId;
    private Long clienteId;
    private Long processoId;
    private Long usuarioId;

    @Size(max = 120)
    private String bancoNome;
    private Integer numeroBanco;

    @NotBlank
    @Size(max = 50)
    private String numeroLancamento;

    @NotNull
    private LocalDate dataLancamento;
    private LocalDate dataCompetencia;

    @NotBlank
    @Size(max = 500)
    private String descricao;
    private String descricaoDetalhada;

    @Size(max = 120)
    private String documentoReferencia;

    @NotNull
    private BigDecimal valor;

    @NotNull
    private LancamentoNatureza natureza;

    @Size(max = 1)
    private String refTipo;

    @Size(max = 120)
    private String eqReferencia;

    @Size(max = 30)
    private String parcelaRef;

    private LancamentoStatus status;
    private LancamentoOrigem origem;
    private String observacao;
    private String metadadosJson;

    public Long getContaContabilId() { return contaContabilId; }
    public void setContaContabilId(Long contaContabilId) { this.contaContabilId = contaContabilId; }
    public Long getClassificacaoFinanceiraId() { return classificacaoFinanceiraId; }
    public void setClassificacaoFinanceiraId(Long classificacaoFinanceiraId) { this.classificacaoFinanceiraId = classificacaoFinanceiraId; }
    public Long getEloFinanceiroId() { return eloFinanceiroId; }
    public void setEloFinanceiroId(Long eloFinanceiroId) { this.eloFinanceiroId = eloFinanceiroId; }
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
    public LancamentoNatureza getNatureza() { return natureza; }
    public void setNatureza(LancamentoNatureza natureza) { this.natureza = natureza; }
    public String getRefTipo() { return refTipo; }
    public void setRefTipo(String refTipo) { this.refTipo = refTipo; }
    public String getEqReferencia() { return eqReferencia; }
    public void setEqReferencia(String eqReferencia) { this.eqReferencia = eqReferencia; }
    public String getParcelaRef() { return parcelaRef; }
    public void setParcelaRef(String parcelaRef) { this.parcelaRef = parcelaRef; }
    public LancamentoStatus getStatus() { return status; }
    public void setStatus(LancamentoStatus status) { this.status = status; }
    public LancamentoOrigem getOrigem() { return origem; }
    public void setOrigem(LancamentoOrigem origem) { this.origem = origem; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public String getMetadadosJson() { return metadadosJson; }
    public void setMetadadosJson(String metadadosJson) { this.metadadosJson = metadadosJson; }
}
