package br.com.vilareal.financeiro.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class LancamentoNaoVinculadoPagamentoResponse {

    private Long id;
    private LocalDate dataLancamento;
    private String descricao;
    private String descricaoDetalhada;
    private BigDecimal valor;
    private String bancoNome;
    private Integer numeroBanco;
    private Long contaContabilId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDate getDataLancamento() {
        return dataLancamento;
    }

    public void setDataLancamento(LocalDate dataLancamento) {
        this.dataLancamento = dataLancamento;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricaoDetalhada() {
        return descricaoDetalhada;
    }

    public void setDescricaoDetalhada(String descricaoDetalhada) {
        this.descricaoDetalhada = descricaoDetalhada;
    }

    public BigDecimal getValor() {
        return valor;
    }

    public void setValor(BigDecimal valor) {
        this.valor = valor;
    }

    public String getBancoNome() {
        return bancoNome;
    }

    public void setBancoNome(String bancoNome) {
        this.bancoNome = bancoNome;
    }

    public Integer getNumeroBanco() {
        return numeroBanco;
    }

    public void setNumeroBanco(Integer numeroBanco) {
        this.numeroBanco = numeroBanco;
    }

    public Long getContaContabilId() {
        return contaContabilId;
    }

    public void setContaContabilId(Long contaContabilId) {
        this.contaContabilId = contaContabilId;
    }
}
