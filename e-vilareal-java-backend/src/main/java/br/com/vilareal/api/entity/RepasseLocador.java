package br.com.vilareal.api.entity;

import br.com.vilareal.api.entity.enums.RepasseLocadorStatus;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "repasses_locador", indexes = {
        @Index(name = "idx_repasses_contrato", columnList = "contrato_id"),
        @Index(name = "idx_repasses_competencia", columnList = "competencia_mes"),
        @Index(name = "idx_repasses_status", columnList = "status")
}, uniqueConstraints = @UniqueConstraint(name = "uk_repasses_contrato_competencia", columnNames = {"contrato_id", "competencia_mes"}))
public class RepasseLocador {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contrato_id", nullable = false, foreignKey = @ForeignKey(name = "fk_repasses_contrato"))
    private ContratoLocacao contrato;

    @Column(name = "competencia_mes", nullable = false, length = 7)
    private String competenciaMes;

    @Column(name = "valor_recebido_inquilino", precision = 15, scale = 2)
    private BigDecimal valorRecebidoInquilino;

    @Column(name = "valor_repassado_locador", precision = 15, scale = 2)
    private BigDecimal valorRepassadoLocador;

    @Column(name = "valor_despesas_repassar", precision = 15, scale = 2)
    private BigDecimal valorDespesasRepassar;

    @Column(name = "remuneracao_escritorio", precision = 15, scale = 2)
    private BigDecimal remuneracaoEscritorio;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RepasseLocadorStatus status = RepasseLocadorStatus.PENDENTE;

    @Column(name = "data_repasse_efetiva")
    private LocalDate dataRepasseEfetiva;

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lancamento_financeiro_vinculo_id", foreignKey = @ForeignKey(name = "fk_repasses_lancamento"))
    private LancamentoFinanceiro lancamentoFinanceiroVinculo;

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
    public BigDecimal getValorRecebidoInquilino() { return valorRecebidoInquilino; }
    public void setValorRecebidoInquilino(BigDecimal valorRecebidoInquilino) { this.valorRecebidoInquilino = valorRecebidoInquilino; }
    public BigDecimal getValorRepassadoLocador() { return valorRepassadoLocador; }
    public void setValorRepassadoLocador(BigDecimal valorRepassadoLocador) { this.valorRepassadoLocador = valorRepassadoLocador; }
    public BigDecimal getValorDespesasRepassar() { return valorDespesasRepassar; }
    public void setValorDespesasRepassar(BigDecimal valorDespesasRepassar) { this.valorDespesasRepassar = valorDespesasRepassar; }
    public BigDecimal getRemuneracaoEscritorio() { return remuneracaoEscritorio; }
    public void setRemuneracaoEscritorio(BigDecimal remuneracaoEscritorio) { this.remuneracaoEscritorio = remuneracaoEscritorio; }
    public RepasseLocadorStatus getStatus() { return status; }
    public void setStatus(RepasseLocadorStatus status) { this.status = status; }
    public LocalDate getDataRepasseEfetiva() { return dataRepasseEfetiva; }
    public void setDataRepasseEfetiva(LocalDate dataRepasseEfetiva) { this.dataRepasseEfetiva = dataRepasseEfetiva; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public LancamentoFinanceiro getLancamentoFinanceiroVinculo() { return lancamentoFinanceiroVinculo; }
    public void setLancamentoFinanceiroVinculo(LancamentoFinanceiro lancamentoFinanceiroVinculo) { this.lancamentoFinanceiroVinculo = lancamentoFinanceiroVinculo; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
