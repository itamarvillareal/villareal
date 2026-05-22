package br.com.vilareal.pagamento.api.dto.recorrencia;

import java.math.BigDecimal;
import java.time.Instant;

public class PagamentoRecorrenciaConfigResponse {

    private Long id;
    private Long imovelId;
    private Integer imovelNumeroPlanilha;
    private String imovelEndereco;
    private Long clienteId;
    private Long contratoLocacaoId;
    private String categoria;
    private String descricaoPadrao;
    private String contaReferencia;
    private Integer diaVencimento;
    private BigDecimal valorEstimado;
    private String formaPagamento;
    private Long responsavelUsuarioId;
    private String prioridade;
    private boolean ativo;
    private Long criadoPorUsuarioId;
    private Instant criadoEm;
    private Instant atualizadoEm;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getImovelId() {
        return imovelId;
    }

    public void setImovelId(Long imovelId) {
        this.imovelId = imovelId;
    }

    public Integer getImovelNumeroPlanilha() {
        return imovelNumeroPlanilha;
    }

    public void setImovelNumeroPlanilha(Integer imovelNumeroPlanilha) {
        this.imovelNumeroPlanilha = imovelNumeroPlanilha;
    }

    public String getImovelEndereco() {
        return imovelEndereco;
    }

    public void setImovelEndereco(String imovelEndereco) {
        this.imovelEndereco = imovelEndereco;
    }

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
    }

    public Long getContratoLocacaoId() {
        return contratoLocacaoId;
    }

    public void setContratoLocacaoId(Long contratoLocacaoId) {
        this.contratoLocacaoId = contratoLocacaoId;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public String getDescricaoPadrao() {
        return descricaoPadrao;
    }

    public void setDescricaoPadrao(String descricaoPadrao) {
        this.descricaoPadrao = descricaoPadrao;
    }

    public String getContaReferencia() {
        return contaReferencia;
    }

    public void setContaReferencia(String contaReferencia) {
        this.contaReferencia = contaReferencia;
    }

    public Integer getDiaVencimento() {
        return diaVencimento;
    }

    public void setDiaVencimento(Integer diaVencimento) {
        this.diaVencimento = diaVencimento;
    }

    public BigDecimal getValorEstimado() {
        return valorEstimado;
    }

    public void setValorEstimado(BigDecimal valorEstimado) {
        this.valorEstimado = valorEstimado;
    }

    public String getFormaPagamento() {
        return formaPagamento;
    }

    public void setFormaPagamento(String formaPagamento) {
        this.formaPagamento = formaPagamento;
    }

    public Long getResponsavelUsuarioId() {
        return responsavelUsuarioId;
    }

    public void setResponsavelUsuarioId(Long responsavelUsuarioId) {
        this.responsavelUsuarioId = responsavelUsuarioId;
    }

    public String getPrioridade() {
        return prioridade;
    }

    public void setPrioridade(String prioridade) {
        this.prioridade = prioridade;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public void setAtivo(boolean ativo) {
        this.ativo = ativo;
    }

    public Long getCriadoPorUsuarioId() {
        return criadoPorUsuarioId;
    }

    public void setCriadoPorUsuarioId(Long criadoPorUsuarioId) {
        this.criadoPorUsuarioId = criadoPorUsuarioId;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(Instant criadoEm) {
        this.criadoEm = criadoEm;
    }

    public Instant getAtualizadoEm() {
        return atualizadoEm;
    }

    public void setAtualizadoEm(Instant atualizadoEm) {
        this.atualizadoEm = atualizadoEm;
    }
}
