package br.com.vilareal.processo.infrastructure.persistence.entity;

import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "processo_andamento")
@Getter
@Setter
public class ProcessoAndamentoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_id", nullable = false)
    private ProcessoEntity processo;

    @Column(name = "movimento_em", nullable = false)
    private Instant movimentoEm;

    @Column(nullable = false, length = 500)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String detalhe;

    @Column(nullable = false, length = 40)
    private String origem = "MANUAL";

    @Column(name = "origem_automatica", nullable = false)
    private Boolean origemAutomatica = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id")
    private UsuarioEntity usuario;
}
