package br.com.vilareal.localidade.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "municipio")
@Getter
@Setter
public class MunicipioEntity {

    @Id
    private Integer id;

    @Column(nullable = false, length = 120)
    private String nome;

    @Column(name = "nome_normalizado", nullable = false, length = 120)
    private String nomeNormalizado;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uf_id", nullable = false)
    private EstadoEntity estado;

    @Column(nullable = false)
    private Boolean favorito = false;

    @Column(name = "uso_count", nullable = false)
    private Integer usoCount = 0;
}
