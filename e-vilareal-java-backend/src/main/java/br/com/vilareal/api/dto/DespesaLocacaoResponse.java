package br.com.vilareal.api.dto;

import br.com.vilareal.api.entity.enums.DespesaLocacaoCategoria;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class DespesaLocacaoResponse {
    private Long id;
    private Long contratoId;
    private String competenciaMes;
    private String descricao;
    private BigDecimal valor;
    private DespesaLocacaoCategoria categoria;
    private Long lancamentoFinanceiroId;
    private String observacao;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getContratoId() { return contratoId; }
    public void setContratoId(Long contratoId) { this.contratoId = contratoId; }
    public String getCompetenciaMes() { return competenciaMes; }
    public void setCompetenciaMes(String competenciaMes) { this.competenciaMes = competenciaMes; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public BigDecimal getValor() { return valor; }
    public void setValor(BigDecimal valor) { this.valor = valor; }
    public DespesaLocacaoCategoria getCategoria() { return categoria; }
    public void setCategoria(DespesaLocacaoCategoria categoria) { this.categoria = categoria; }
    public Long getLancamentoFinanceiroId() { return lancamentoFinanceiroId; }
    public void setLancamentoFinanceiroId(Long lancamentoFinanceiroId) { this.lancamentoFinanceiroId = lancamentoFinanceiroId; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
