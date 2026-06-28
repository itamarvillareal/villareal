package br.com.vilareal.orgaojulgador.infrastructure.persistence.entity;

import br.com.vilareal.localidade.infrastructure.persistence.entity.MunicipioEntity;
import br.com.vilareal.orgaojulgador.domain.OrgaoJulgadorTipo;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "orgao_julgador")
@Getter
@Setter
public class OrgaoJulgadorEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tribunal_id", nullable = false)
    private TribunalEntity tribunal;

    @Column(name = "codigo_cnj", nullable = false)
    private Integer codigoCnj;

    @Column(nullable = false, length = 255)
    private String nome;

    @Column(length = 8)
    private String grau;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OrgaoJulgadorTipo tipo = OrgaoJulgadorTipo.OUTRO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "municipio_id")
    private MunicipioEntity municipio;

    @Column(nullable = false)
    private Boolean favorito = false;

    @Column(name = "uso_count", nullable = false)
    private Integer usoCount = 0;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "synced_at")
    private Instant syncedAt;
}
