package br.com.vilareal.pagamento.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "prestacao_contas_pagamento")
@Getter
@Setter
public class PrestacaoContasPagamentoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "prestacao_contas_id", nullable = false)
    private PrestacaoContasEntity prestacaoContas;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pagamento_id", nullable = false)
    private PagamentoEntity pagamento;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;
}
