package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Linha de extrato / consolidado persistida. Estrutura alinhada a {@code V7__financeiro.sql}
 * ({@code financeiro_lancamento}): valor sempre ≥ 0 com {@link NaturezaLancamento} definindo o sinal contábil na API.
 */
@Entity
@Table(name = "financeiro_lancamento")
@Getter
@Setter
public class LancamentoFinanceiroEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conta_contabil_id", nullable = false)
    private ContaContabilEntity contaContabil;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id")
    private PessoaEntity cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

    @Column(name = "banco_nome", length = 120)
    private String bancoNome;

    @Column(name = "numero_banco")
    private Integer numeroBanco;

    @Column(name = "numero_lancamento", nullable = false, length = 80)
    private String numeroLancamento;

    @Column(name = "data_lancamento", nullable = false)
    private LocalDate dataLancamento;

    @Column(name = "data_competencia")
    private LocalDate dataCompetencia;

    @Column(nullable = false, length = 500)
    private String descricao;

    @Column(name = "descricao_detalhada", length = 2000)
    private String descricaoDetalhada;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal valor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private NaturezaLancamento natureza;

    @Column(name = "ref_tipo", nullable = false, length = 1)
    private String refTipo = "N";

    @Column(name = "eq_referencia", length = 120)
    private String eqReferencia;

    @Column(name = "parcela_ref", length = 80)
    private String parcelaRef;

    @Column(nullable = false, length = 40)
    private String origem = "MANUAL";

    @Column(nullable = false, length = 20)
    private String status = "ATIVO";

    @Column(name = "classificacao_financeira_id")
    private Long classificacaoFinanceiraId;

    @Column(name = "elo_financeiro_id")
    private Long eloFinanceiroId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
