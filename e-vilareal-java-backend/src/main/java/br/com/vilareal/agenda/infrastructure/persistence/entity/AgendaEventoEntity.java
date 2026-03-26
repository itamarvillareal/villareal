package br.com.vilareal.agenda.infrastructure.persistence.entity;

import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "agenda_evento")
@Getter
@Setter
public class AgendaEventoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private UsuarioEntity usuario;

    @Column(name = "data_evento", nullable = false)
    private LocalDate dataEvento;

    @Column(name = "hora_evento", length = 16)
    private String horaEvento;

    @Column(nullable = false, length = 2000)
    private String descricao;

    @Column(name = "status_curto", length = 8)
    private String statusCurto;

    @Column(name = "processo_ref", length = 120)
    private String processoRef;

    @Column(nullable = false, length = 80)
    private String origem = "frontend-agenda";

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
