package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Vínculo do acerto fechado com os grupos de compensação cobertos por ele (V205). */
@Entity
@Table(name = "acerto_fechamento_grupo")
@Getter
@Setter
public class AcertoFechamentoGrupoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "acerto_fechamento_id", nullable = false)
    private AcertoFechamentoEntity acertoFechamento;

    @Column(name = "grupo_compensacao", nullable = false, length = 40)
    private String grupoCompensacao;
}
