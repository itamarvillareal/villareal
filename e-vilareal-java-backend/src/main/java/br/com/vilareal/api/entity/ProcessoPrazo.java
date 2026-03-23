package br.com.vilareal.api.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "processo_prazos", indexes = {
        @Index(name = "idx_proc_prazos_processo", columnList = "processo_id"),
        @Index(name = "idx_proc_prazos_data_fim", columnList = "data_fim"),
        @Index(name = "idx_proc_prazos_status", columnList = "status")
})
public class ProcessoPrazo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_id", nullable = false, foreignKey = @ForeignKey(name = "fk_proc_prazos_processo"))
    private Processo processo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "andamento_id", foreignKey = @ForeignKey(name = "fk_proc_prazos_andamento"))
    private ProcessoAndamento andamento;

    @Column(nullable = false, length = 500)
    private String descricao;

    @Column(name = "data_inicio")
    private LocalDate dataInicio;

    @Column(name = "data_fim", nullable = false)
    private LocalDate dataFim;

    @Column(name = "prazo_fatal", nullable = false)
    private Boolean prazoFatal = false;

    @Column(nullable = false, length = 30)
    private String status = "PENDENTE";

    @Column(name = "cumprido_em")
    private LocalDateTime cumpridoEm;

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Processo getProcesso() { return processo; }
    public void setProcesso(Processo processo) { this.processo = processo; }
    public ProcessoAndamento getAndamento() { return andamento; }
    public void setAndamento(ProcessoAndamento andamento) { this.andamento = andamento; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public LocalDate getDataInicio() { return dataInicio; }
    public void setDataInicio(LocalDate dataInicio) { this.dataInicio = dataInicio; }
    public LocalDate getDataFim() { return dataFim; }
    public void setDataFim(LocalDate dataFim) { this.dataFim = dataFim; }
    public Boolean getPrazoFatal() { return prazoFatal; }
    public void setPrazoFatal(Boolean prazoFatal) { this.prazoFatal = prazoFatal; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCumpridoEm() { return cumpridoEm; }
    public void setCumpridoEm(LocalDateTime cumpridoEm) { this.cumpridoEm = cumpridoEm; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
