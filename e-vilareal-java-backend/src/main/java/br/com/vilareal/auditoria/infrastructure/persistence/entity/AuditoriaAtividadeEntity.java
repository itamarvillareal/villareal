package br.com.vilareal.auditoria.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "auditoria_atividade")
@Getter
@Setter
public class AuditoriaAtividadeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ocorrido_em", nullable = false)
    private Instant ocorridoEm;

    @Column(name = "usuario_ref", nullable = false, length = 120)
    private String usuarioRef;

    @Column(name = "usuario_nome", nullable = false, length = 255)
    private String usuarioNome;

    @Column(nullable = false, length = 255)
    private String modulo;

    @Column(nullable = false, length = 500)
    private String tela;

    @Column(name = "tipo_acao", nullable = false, length = 80)
    private String tipoAcao;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descricao;

    @Column(name = "registro_afetado_id", length = 120)
    private String registroAfetadoId;

    @Column(name = "registro_afetado_nome", length = 500)
    private String registroAfetadoNome;

    @Column(name = "ip_origem", length = 80)
    private String ipOrigem;

    @Column(name = "observacoes_tecnicas", columnDefinition = "TEXT")
    private String observacoesTecnicas;
}
