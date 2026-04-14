package br.com.vilareal.pessoa.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "pessoa_contato")
@Getter
@Setter
public class PessoaContatoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pessoa_id", nullable = false)
    private PessoaEntity pessoa;

    @Column(nullable = false, length = 20)
    private String tipo;

    @Column(nullable = false, length = 500)
    private String valor;

    @Column(name = "importacao_id", length = 36)
    private String importacaoId;

    @Column(name = "data_lancamento", nullable = false)
    private Instant dataLancamento;

    @Column(name = "data_alteracao", nullable = false)
    private Instant dataAlteracao;

    @Column(name = "usuario_lancamento", nullable = false, length = 120)
    private String usuarioLancamento;
}
