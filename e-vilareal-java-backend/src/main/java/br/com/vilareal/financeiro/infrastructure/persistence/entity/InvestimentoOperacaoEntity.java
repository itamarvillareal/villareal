package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import br.com.vilareal.financeiro.domain.InvestimentoOperacaoStatus;
import br.com.vilareal.financeiro.domain.InvestimentoVinculoConfianca;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "financeiro_investimento_operacao")
@Getter
@Setter
public class InvestimentoOperacaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conta_bancaria_id", nullable = false)
    private ContaBancariaEntity contaBancaria;

    @Column(name = "codigo_produto", nullable = false, length = 40)
    private String codigoProduto;

    @Column(name = "tipo_produto", length = 10)
    private String tipoProduto;

    @Column(length = 120)
    private String emissor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InvestimentoOperacaoStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compra_movimentacao_id")
    private InvestimentoMovimentacaoEntity compraMovimentacao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venda_movimentacao_id")
    private InvestimentoMovimentacaoEntity vendaMovimentacao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compra_lancamento_id")
    private LancamentoFinanceiroEntity compraLancamento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venda_lancamento_id")
    private LancamentoFinanceiroEntity vendaLancamento;

    @Column(name = "data_compra")
    private LocalDate dataCompra;

    @Column(name = "data_venda")
    private LocalDate dataVenda;

    @Column(name = "valor_compra_caixa", precision = 19, scale = 2)
    private BigDecimal valorCompraCaixa;

    @Column(name = "valor_venda_caixa", precision = 19, scale = 2)
    private BigDecimal valorVendaCaixa;

    @Column(name = "valor_irrf", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorIrrf = BigDecimal.ZERO;

    @Column(name = "valor_iof", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorIof = BigDecimal.ZERO;

    @Column(name = "valor_custos", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorCustos = BigDecimal.ZERO;

    @Column(name = "valor_liquido_entrada", precision = 19, scale = 2)
    private BigDecimal valorLiquidoEntrada;

    @Column(name = "lucro_liquido", precision = 19, scale = 2)
    private BigDecimal lucroLiquido;

    @Column(name = "dias_carteira")
    private Integer diasCarteira;

    @Column(name = "taxa_mensal_liquida", precision = 12, scale = 8)
    private BigDecimal taxaMensalLiquida;

    @Column(name = "taxa_anual_liquida", precision = 12, scale = 8)
    private BigDecimal taxaAnualLiquida;

    @Enumerated(EnumType.STRING)
    @Column(name = "vinculo_confianca", length = 10)
    private InvestimentoVinculoConfianca vinculoConfianca;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
