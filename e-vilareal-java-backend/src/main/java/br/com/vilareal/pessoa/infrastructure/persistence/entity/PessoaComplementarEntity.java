package br.com.vilareal.pessoa.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "pessoa_complementar")
@Getter
@Setter
public class PessoaComplementarEntity {

    @Id
    @Column(name = "pessoa_id")
    private Long pessoaId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "pessoa_id")
    private PessoaEntity pessoa;

    @Column(length = 40)
    private String rg;

    @Column(name = "orgao_expedidor", length = 120)
    private String orgaoExpedidor;

    @Column(length = 255)
    private String profissao;

    @Column(length = 120)
    private String nacionalidade;

    @Column(name = "estado_civil", length = 40)
    private String estadoCivil;

    @Column(length = 8)
    private String genero;
}
