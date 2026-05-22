package br.com.vilareal.pagamento.api.dto.recorrencia;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public class PagamentoRecorrenciaConfigWriteRequest {

    @NotNull
    private Long imovelId;

    private Long clienteId;

    private Long contratoLocacaoId;

    @NotBlank
    @Size(max = 40)
    private String categoria;

    @NotBlank
    @Size(max = 500)
    private String descricaoPadrao;

    @Size(max = 50)
    private String contaReferencia;

    @NotNull
    @Min(1)
    @Max(31)
    private Integer diaVencimento;

    private BigDecimal valorEstimado;

    @NotBlank
    @Size(max = 40)
    private String formaPagamento;

    private Long responsavelUsuarioId;

    @Size(max = 24)
    private String prioridade;

    public Long getImovelId() {
        return imovelId;
    }

    public void setImovelId(Long imovelId) {
        this.imovelId = imovelId;
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
}
