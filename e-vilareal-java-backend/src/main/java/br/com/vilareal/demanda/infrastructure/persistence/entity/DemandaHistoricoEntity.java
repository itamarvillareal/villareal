package br.com.vilareal.demanda.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "demanda_historico")
@Getter
@Setter
public class DemandaHistoricoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "demanda_id", nullable = false)
    private DemandaEntity demanda;

    @Column(name = "status_anterior", length = 30)
    private String statusAnterior;

    @Column(name = "status_novo", nullable = false, length = 30)
    private String statusNovo;

    @Column(name = "descricao_acao", length = 500)
    private String descricaoAcao;

    @Column(name = "usuario_id")
    private Long usuarioId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;
}
