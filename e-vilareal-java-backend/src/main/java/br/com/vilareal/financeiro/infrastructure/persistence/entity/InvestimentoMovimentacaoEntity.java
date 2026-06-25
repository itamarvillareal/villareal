package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import br.com.vilareal.financeiro.domain.InvestimentoVinculoConfianca;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "financeiro_investimento_movimentacao")
@Getter
@Setter
public class InvestimentoMovimentacaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "import_id", nullable = false)
    private InvestimentoImportEntity importBatch;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conta_bancaria_id", nullable = false)
    private ContaBancariaEntity contaBancaria;

    @Column(name = "natureza_mov", nullable = false, length = 10)
    private String naturezaMov;

    @Column(name = "data_movimentacao", nullable = false)
    private LocalDate dataMovimentacao;

    @Column(name = "tipo_movimentacao", nullable = false, length = 80)
    private String tipoMovimentacao;

    @Column(name = "produto_raw", nullable = false, length = 500)
    private String produtoRaw;

    @Column(name = "codigo_produto", length = 40)
    private String codigoProduto;

    @Column(name = "tipo_produto", length = 10)
    private String tipoProduto;

    @Column(length = 120)
    private String emissor;

    @Column(length = 120)
    private String instituicao;

    @Column(precision = 19, scale = 6)
    private BigDecimal quantidade;

    @Column(name = "preco_unitario", precision = 19, scale = 6)
    private BigDecimal precoUnitario;

    @Column(name = "valor_operacao", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorOperacao;

    /** C = COMPRA no extrato (saída de caixa); V = VENDA no extrato (entrada). */
    @Column(name = "tipo_extrato", length = 1)
    private String tipoExtrato;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lancamento_financeiro_id")
    private LancamentoFinanceiroEntity lancamentoFinanceiro;

    @Enumerated(EnumType.STRING)
    @Column(name = "vinculo_confianca", length = 10)
    private InvestimentoVinculoConfianca vinculoConfianca;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
