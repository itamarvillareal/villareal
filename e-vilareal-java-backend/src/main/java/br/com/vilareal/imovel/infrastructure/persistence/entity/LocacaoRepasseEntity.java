package br.com.vilareal.imovel.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "locacao_repasse")
@Getter
@Setter
public class LocacaoRepasseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contrato_locacao_id", nullable = false)
    private ContratoLocacaoEntity contratoLocacao;

    @Column(name = "competencia_mes", length = 7)
    private String competenciaMes;

    @Column(name = "valor_recebido_inquilino", precision = 19, scale = 2)
    private BigDecimal valorRecebidoInquilino;

    @Column(name = "valor_repassado_locador", precision = 19, scale = 2)
    private BigDecimal valorRepassadoLocador;

    @Column(name = "valor_despesas_repassar", precision = 19, scale = 2)
    private BigDecimal valorDespesasRepassar;

    @Column(name = "remuneracao_escritorio", precision = 19, scale = 2)
    private BigDecimal remuneracaoEscritorio;

    @Column(nullable = false, length = 40)
    private String status = "PENDENTE";

    @Column(name = "data_repasse_efetiva")
    private LocalDate dataRepasseEfetiva;

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @Column(name = "lancamento_financeiro_vinculo_id")
    private Long lancamentoFinanceiroVinculoId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
