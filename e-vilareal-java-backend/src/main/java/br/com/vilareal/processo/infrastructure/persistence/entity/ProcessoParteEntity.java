package br.com.vilareal.processo.infrastructure.persistence.entity;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "processo_parte")
@Getter
@Setter
public class ProcessoParteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_id", nullable = false)
    private ProcessoEntity processo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pessoa_id")
    private PessoaEntity pessoa;

    @Column(name = "nome_livre", length = 500)
    private String nomeLivre;

    @Column(nullable = false, length = 40)
    private String polo;

    @Column(length = 255)
    private String qualificacao;

    @Column(nullable = false)
    private Integer ordem = 0;

    @Column(name = "importacao_id", length = 36)
    private String importacaoId;
}
