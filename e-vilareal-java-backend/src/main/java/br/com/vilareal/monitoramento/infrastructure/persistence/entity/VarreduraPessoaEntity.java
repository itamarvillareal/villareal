package br.com.vilareal.monitoramento.infrastructure.persistence.entity;

import br.com.vilareal.monitoramento.domain.StatusVarredura;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** Execução de varredura PROJUDI de uma pessoa monitorada (baseline ou incremental). */
@Entity
@Table(name = "varredura_pessoa")
@Getter
@Setter
public class VarreduraPessoaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pessoa_id", nullable = false)
    private PessoaEntity pessoa;

    @Column(nullable = false)
    private LocalDateTime inicio;

    private LocalDateTime fim;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatusVarredura status;

    @Column(name = "paginas_lidas", nullable = false)
    private Integer paginasLidas = 0;

    @Column(nullable = false)
    private Integer encontrados = 0;

    @Column(nullable = false)
    private Integer novos = 0;

    @Column(name = "qtd_segredo", nullable = false)
    private Integer qtdSegredo = 0;

    @Column(name = "erro_codigo", length = 40)
    private String erroCodigo;

    @Column(name = "erro_mensagem", columnDefinition = "TEXT")
    private String erroMensagem;
}
