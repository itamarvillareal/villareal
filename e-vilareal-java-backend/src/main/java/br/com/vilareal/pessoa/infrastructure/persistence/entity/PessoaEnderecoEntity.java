package br.com.vilareal.pessoa.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "pessoa_endereco")
@Getter
@Setter
public class PessoaEnderecoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pessoa_id", nullable = false)
    private PessoaEntity pessoa;

    @Column(name = "numero_ordem", nullable = false)
    private Integer numeroOrdem;

    @Column(nullable = false, length = 255)
    private String rua;

    @Column(length = 120)
    private String bairro;

    @Column(length = 2)
    private String estado;

    @Column(length = 120)
    private String cidade;

    @Column(length = 8)
    private String cep;

    @Column(name = "auto_preenchido", nullable = false)
    private Boolean autoPreenchido = false;
}
