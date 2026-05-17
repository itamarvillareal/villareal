package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "financeiro_lancamento_cartao")
@Getter
@Setter
public class LancamentoCartaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cartao_id", nullable = false)
    private CartaoEntity cartao;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conta_contabil_id", nullable = false)
    private ContaContabilEntity contaContabil;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id")
    private PessoaEntity cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

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

    /** Sinal da fatura (compra positiva). */
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal valor;

    @Column(name = "ref_tipo", nullable = false, length = 1)
    private String refTipo = "N";

    @Column(nullable = false, length = 40)
    private String origem = "MANUAL";

    @Column(nullable = false, length = 20)
    private String status = "ATIVO";

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
