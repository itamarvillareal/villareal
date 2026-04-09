package br.com.vilareal.imovel.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "locacao_despesa")
@Getter
@Setter
public class LocacaoDespesaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contrato_locacao_id", nullable = false)
    private ContratoLocacaoEntity contratoLocacao;

    @Column(name = "competencia_mes", length = 7)
    private String competenciaMes;

    @Column(nullable = false, length = 500)
    private String descricao;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal valor;

    @Column(nullable = false, length = 80)
    private String categoria = "OUTROS";

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @Column(name = "lancamento_financeiro_id")
    private Long lancamentoFinanceiroId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
