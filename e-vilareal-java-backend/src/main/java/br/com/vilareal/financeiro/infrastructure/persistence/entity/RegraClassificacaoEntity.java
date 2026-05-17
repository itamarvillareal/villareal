package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import br.com.vilareal.financeiro.domain.TipoMatch;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "financeiro_regra_classificacao")
@Getter
@Setter
public class RegraClassificacaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "padrao_descricao", nullable = false, length = 255)
    private String padraoDescricao;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_match", nullable = false, length = 20)
    private TipoMatch tipoMatch = TipoMatch.CONTAINS;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conta_contabil_id", nullable = false)
    private ContaContabilEntity contaContabil;

    @Column(name = "numero_banco")
    private Integer numeroBanco;

    @Column(nullable = false)
    private Integer prioridade = 100;

    @Column(nullable = false)
    private Boolean ativo = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id")
    private PessoaEntity cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;
}
