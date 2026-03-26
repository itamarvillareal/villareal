package br.com.vilareal.tarefa.infrastructure.persistence.entity;

import br.com.vilareal.tarefa.model.TarefaPrioridade;
import br.com.vilareal.tarefa.model.TarefaStatus;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "tarefa_operacional")
@Getter
@Setter
public class TarefaOperacionalEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsavel_usuario_id")
    private UsuarioEntity responsavel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TarefaStatus status = TarefaStatus.PENDENTE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TarefaPrioridade prioridade = TarefaPrioridade.NORMAL;

    @Column(name = "data_limite")
    private LocalDate dataLimite;

    @Column(name = "cliente_id")
    private Long clienteId;

    @Column(name = "processo_id")
    private Long processoId;

    @Column(name = "publicacao_id")
    private Long publicacaoId;

    @Column(name = "processo_prazo_id")
    private Long processoPrazoId;

    @Column(nullable = false, length = 80)
    private String origem = "BOARD";

    @Column(name = "data_conclusao")
    private Instant dataConclusao;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
