package br.com.vilareal.iptu.infrastructure.persistence.entity;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Formula;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "iptu_parcela")
@Getter
@Setter
public class IptuParcelaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "iptu_anual_id", nullable = false)
    private IptuAnualEntity iptuAnual;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrato_locacao_id")
    private ContratoLocacaoEntity contratoLocacao;

    @Column(name = "competencia_mes", nullable = false, length = 7)
    private String competenciaMes;

    @Column(name = "dias_cobrados", nullable = false)
    private Integer diasCobrados;

    @Column(name = "mes_completo", nullable = false)
    private boolean mesCompleto;

    @Column(name = "valor_calculado", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorCalculado;

    @Column(nullable = false, length = 20)
    private String status = "PENDENTE";

    @Column(name = "data_vencimento")
    private LocalDate dataVencimento;

    @Column(name = "data_pagamento")
    private LocalDate dataPagamento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pagamento_id")
    private PagamentoEntity pagamento;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Formula("(coalesce(contrato_locacao_id, -(iptu_anual_id)))")
    private Long contratoUk;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
