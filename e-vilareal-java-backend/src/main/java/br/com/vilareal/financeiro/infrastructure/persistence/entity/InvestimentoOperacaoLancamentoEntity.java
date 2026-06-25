package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import br.com.vilareal.financeiro.domain.InvestimentoOperacaoLancamentoPapel;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "financeiro_investimento_operacao_lancamento")
@Getter
@Setter
public class InvestimentoOperacaoLancamentoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "operacao_id", nullable = false)
    private InvestimentoOperacaoEntity operacao;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lancamento_id", nullable = false)
    private LancamentoFinanceiroEntity lancamento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private InvestimentoOperacaoLancamentoPapel papel;

    /** Parcela atribuída à operação (imposto genérico rateado); null = valor integral do lançamento. */
    @Column(name = "valor_alocado", precision = 19, scale = 2)
    private BigDecimal valorAlocado;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;
}
