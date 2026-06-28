package br.com.vilareal.orgaojulgador.infrastructure.persistence.entity;

import br.com.vilareal.localidade.infrastructure.persistence.entity.EstadoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "tribunal")
@Getter
@Setter
public class TribunalEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 8)
    private String sigla;

    @Column(nullable = false, length = 120)
    private String nome;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uf_id")
    private EstadoEntity estado;

    @Column(name = "datajud_alias", nullable = false, length = 64)
    private String datajudAlias;

    @Column(nullable = false)
    private Boolean ativo = false;
}
