package br.com.vilareal.api.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "tarefa_operacional_historico", indexes = {
        @Index(name = "idx_tarefa_hist_tarefa", columnList = "tarefa_id"),
        @Index(name = "idx_tarefa_hist_created", columnList = "created_at")
})
public class TarefaOperacionalHistorico {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tarefa_id", nullable = false, foreignKey = @ForeignKey(name = "fk_tarefa_hist_tarefa"))
    private TarefaOperacional tarefa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", foreignKey = @ForeignKey(name = "fk_tarefa_hist_usuario"))
    private Usuario usuario;

    @Column(nullable = false, length = 30)
    private String tipo = "STATUS_ALTERADO";

    @Column(name = "status_anterior", length = 30)
    private String statusAnterior;

    @Column(name = "status_novo", length = 30)
    private String statusNovo;

    @Column(columnDefinition = "TEXT")
    private String detalhe;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public TarefaOperacional getTarefa() { return tarefa; }
    public void setTarefa(TarefaOperacional tarefa) { this.tarefa = tarefa; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getStatusAnterior() { return statusAnterior; }
    public void setStatusAnterior(String statusAnterior) { this.statusAnterior = statusAnterior; }
    public String getStatusNovo() { return statusNovo; }
    public void setStatusNovo(String statusNovo) { this.statusNovo = statusNovo; }
    public String getDetalhe() { return detalhe; }
    public void setDetalhe(String detalhe) { this.detalhe = detalhe; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
