package br.com.vilareal.imovel.api.dto;

import java.math.BigDecimal;

public class LocacaoDespesaResponse {

    private Long id;
    private Long contratoId;
    private String competenciaMes;
    private String descricao;
    private BigDecimal valor;
    private String categoria;
    private String observacao;
    private Long lancamentoFinanceiroId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getContratoId() {
        return contratoId;
    }

    public void setContratoId(Long contratoId) {
        this.contratoId = contratoId;
    }

    public String getCompetenciaMes() {
        return competenciaMes;
    }

    public void setCompetenciaMes(String competenciaMes) {
        this.competenciaMes = competenciaMes;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public BigDecimal getValor() {
        return valor;
    }

    public void setValor(BigDecimal valor) {
        this.valor = valor;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }

    public Long getLancamentoFinanceiroId() {
        return lancamentoFinanceiroId;
    }

    public void setLancamentoFinanceiroId(Long lancamentoFinanceiroId) {
        this.lancamentoFinanceiroId = lancamentoFinanceiroId;
    }
}
