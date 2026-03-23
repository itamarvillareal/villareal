package br.com.vilareal.api.entity;

import br.com.vilareal.api.entity.enums.TarefaOperacionalOrigem;
import br.com.vilareal.api.entity.enums.TarefaOperacionalPrioridade;
import br.com.vilareal.api.entity.enums.TarefaOperacionalStatus;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tarefas_operacionais", indexes = {
        @Index(name = "idx_tarefas_responsavel", columnList = "responsavel_usuario_id"),
        @Index(name = "idx_tarefas_status", columnList = "status"),
        @Index(name = "idx_tarefas_prioridade", columnList = "prioridade"),
        @Index(name = "idx_tarefas_origem", columnList = "origem"),
        @Index(name = "idx_tarefas_cliente", columnList = "cliente_id"),
        @Index(name = "idx_tarefas_processo", columnList = "processo_id"),
        @Index(name = "idx_tarefas_publicacao", columnList = "publicacao_id"),
        @Index(name = "idx_tarefas_data_limite", columnList = "data_limite"),
        @Index(name = "idx_tarefas_criador", columnList = "criador_usuario_id")
})
public class TarefaOperacional {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TarefaOperacionalStatus status = TarefaOperacionalStatus.PENDENTE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TarefaOperacionalPrioridade prioridade = TarefaOperacionalPrioridade.NORMAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TarefaOperacionalOrigem origem = TarefaOperacionalOrigem.MANUAL;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsavel_usuario_id", foreignKey = @ForeignKey(name = "fk_tarefas_responsavel"))
    private Usuario responsavel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "criador_usuario_id", foreignKey = @ForeignKey(name = "fk_tarefas_criador"))
    private Usuario criador;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", foreignKey = @ForeignKey(name = "fk_tarefas_cliente"))
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id", foreignKey = @ForeignKey(name = "fk_tarefas_processo"))
    private Processo processo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "publicacao_id", foreignKey = @ForeignKey(name = "fk_tarefas_publicacao"))
    private Publicacao publicacao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agenda_evento_id", foreignKey = @ForeignKey(name = "fk_tarefas_agenda"))
    private AgendaEvento agendaEvento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_prazo_id", foreignKey = @ForeignKey(name = "fk_tarefas_prazo"))
    private ProcessoPrazo processoPrazo;

    @Column(name = "data_limite")
    private LocalDate dataLimite;

    @Column(name = "data_conclusao")
    private LocalDateTime dataConclusao;

    @Column(name = "observacao_conclusao", columnDefinition = "TEXT")
    private String observacaoConclusao;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public TarefaOperacionalStatus getStatus() { return status; }
    public void setStatus(TarefaOperacionalStatus status) { this.status = status; }
    public TarefaOperacionalPrioridade getPrioridade() { return prioridade; }
    public void setPrioridade(TarefaOperacionalPrioridade prioridade) { this.prioridade = prioridade; }
    public TarefaOperacionalOrigem getOrigem() { return origem; }
    public void setOrigem(TarefaOperacionalOrigem origem) { this.origem = origem; }
    public Usuario getResponsavel() { return responsavel; }
    public void setResponsavel(Usuario responsavel) { this.responsavel = responsavel; }
    public Usuario getCriador() { return criador; }
    public void setCriador(Usuario criador) { this.criador = criador; }
    public Cliente getCliente() { return cliente; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }
    public Processo getProcesso() { return processo; }
    public void setProcesso(Processo processo) { this.processo = processo; }
    public Publicacao getPublicacao() { return publicacao; }
    public void setPublicacao(Publicacao publicacao) { this.publicacao = publicacao; }
    public AgendaEvento getAgendaEvento() { return agendaEvento; }
    public void setAgendaEvento(AgendaEvento agendaEvento) { this.agendaEvento = agendaEvento; }
    public ProcessoPrazo getProcessoPrazo() { return processoPrazo; }
    public void setProcessoPrazo(ProcessoPrazo processoPrazo) { this.processoPrazo = processoPrazo; }
    public LocalDate getDataLimite() { return dataLimite; }
    public void setDataLimite(LocalDate dataLimite) { this.dataLimite = dataLimite; }
    public LocalDateTime getDataConclusao() { return dataConclusao; }
    public void setDataConclusao(LocalDateTime dataConclusao) { this.dataConclusao = dataConclusao; }
    public String getObservacaoConclusao() { return observacaoConclusao; }
    public void setObservacaoConclusao(String observacaoConclusao) { this.observacaoConclusao = observacaoConclusao; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
