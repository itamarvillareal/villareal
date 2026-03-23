package br.com.vilareal.api.entity;

import br.com.vilareal.api.entity.enums.DespesaLocacaoCategoria;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "despesas_locacao", indexes = {
        @Index(name = "idx_despesas_contrato", columnList = "contrato_id"),
        @Index(name = "idx_despesas_competencia", columnList = "competencia_mes"),
        @Index(name = "idx_despesas_lancamento", columnList = "lancamento_financeiro_id")
})
public class DespesaLocacao {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contrato_id", nullable = false, foreignKey = @ForeignKey(name = "fk_despesas_contrato"))
    private ContratoLocacao contrato;

    @Column(name = "competencia_mes", length = 7)
    private String competenciaMes;

    @Column(nullable = false, length = 500)
    private String descricao;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private DespesaLocacaoCategoria categoria = DespesaLocacaoCategoria.OUTROS;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lancamento_financeiro_id", foreignKey = @ForeignKey(name = "fk_despesas_lancamento"))
    private LancamentoFinanceiro lancamentoFinanceiro;

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ContratoLocacao getContrato() { return contrato; }
    public void setContrato(ContratoLocacao contrato) { this.contrato = contrato; }
    public String getCompetenciaMes() { return competenciaMes; }
    public void setCompetenciaMes(String competenciaMes) { this.competenciaMes = competenciaMes; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public BigDecimal getValor() { return valor; }
    public void setValor(BigDecimal valor) { this.valor = valor; }
    public DespesaLocacaoCategoria getCategoria() { return categoria; }
    public void setCategoria(DespesaLocacaoCategoria categoria) { this.categoria = categoria; }
    public LancamentoFinanceiro getLancamentoFinanceiro() { return lancamentoFinanceiro; }
    public void setLancamentoFinanceiro(LancamentoFinanceiro lancamentoFinanceiro) { this.lancamentoFinanceiro = lancamentoFinanceiro; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
