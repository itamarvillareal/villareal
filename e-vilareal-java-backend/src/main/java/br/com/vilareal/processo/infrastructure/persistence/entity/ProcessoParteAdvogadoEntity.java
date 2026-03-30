package br.com.vilareal.processo.infrastructure.persistence.entity;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "processo_parte_advogado")
@Getter
@Setter
public class ProcessoParteAdvogadoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_parte_id", nullable = false)
    private ProcessoParteEntity processoParte;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "advogado_pessoa_id", nullable = false)
    private PessoaEntity advogadoPessoa;

    @Column(nullable = false)
    private Integer ordem = 0;
}
