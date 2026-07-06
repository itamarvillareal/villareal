package br.com.vilareal.pessoa.infrastructure.persistence.entity;

import br.com.vilareal.localidade.infrastructure.persistence.entity.MunicipioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

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

    @Column(length = 120)
    private String complemento;

    @Column(name = "importacao_id", length = 36)
    private String importacaoId;

    @Column(length = 2)
    private String estado;

    @Column(length = 120)
    private String cidade;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "municipio_id")
    private MunicipioEntity municipio;

    @Column(name = "cidade_legado", length = 120)
    private String cidadeLegado;

    @Column(length = 8)
    private String cep;

    @Column(name = "auto_preenchido", nullable = false)
    private Boolean autoPreenchido = false;

    @Column(length = 30)
    private String origem;

    @Column(name = "data_origem")
    private LocalDate dataOrigem;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;
}
