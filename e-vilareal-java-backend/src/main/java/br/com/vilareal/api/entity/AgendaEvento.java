package br.com.vilareal.api.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "agenda_eventos", indexes = {
        @Index(name = "idx_agenda_usuario_data", columnList = "usuario_id,data_evento"),
        @Index(name = "idx_agenda_data", columnList = "data_evento"),
        @Index(name = "idx_agenda_status_curto", columnList = "status_curto")
})
public class AgendaEvento {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false, foreignKey = @ForeignKey(name = "fk_agenda_eventos_usuario"))
    private Usuario usuario;

    @Column(name = "data_evento", nullable = false)
    private LocalDate dataEvento;

    @Column(name = "hora_evento")
    private LocalTime horaEvento;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descricao;

    @Column(name = "status_curto", length = 10)
    private String statusCurto;

    @Column(name = "processo_ref", length = 80)
    private String processoRef;

    @Column(length = 40)
    private String origem;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public LocalDate getDataEvento() { return dataEvento; }
    public void setDataEvento(LocalDate dataEvento) { this.dataEvento = dataEvento; }
    public LocalTime getHoraEvento() { return horaEvento; }
    public void setHoraEvento(LocalTime horaEvento) { this.horaEvento = horaEvento; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public String getStatusCurto() { return statusCurto; }
    public void setStatusCurto(String statusCurto) { this.statusCurto = statusCurto; }
    public String getProcessoRef() { return processoRef; }
    public void setProcessoRef(String processoRef) { this.processoRef = processoRef; }
    public String getOrigem() { return origem; }
    public void setOrigem(String origem) { this.origem = origem; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
