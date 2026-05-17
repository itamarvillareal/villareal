package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "financeiro_pagamento_fatura_vinculo")
@Getter
@Setter
public class PagamentoFaturaVinculoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lancamento_banco_id", nullable = false)
    private LancamentoFinanceiroEntity lancamentoBanco;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lancamento_cartao_id", nullable = false)
    private LancamentoCartaoEntity lancamentoCartao;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;
}
