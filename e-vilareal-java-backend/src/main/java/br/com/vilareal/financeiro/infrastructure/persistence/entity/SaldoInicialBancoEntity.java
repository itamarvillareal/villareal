package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Saldo de abertura (informado pelo usuário) de uma conta bancária, identificada por
 * {@code numero_banco} (Nº do consolidado). Ver migration V107.
 *
 * <p>O {@code valor} é o saldo assinado ao final de {@code dataReferencia} (a véspera do
 * extrato). O cálculo de saldo do banco soma este valor aos movimentos.
 */
@Entity
@Table(name = "financeiro_saldo_inicial")
@Getter
@Setter
public class SaldoInicialBancoEntity {

    /** PK natural — Nº do consolidado da conta (não há cartões aqui). */
    @Id
    @Column(name = "numero_banco")
    private Integer numeroBanco;

    @Column(name = "banco_nome", length = 120)
    private String bancoNome;

    @Column(name = "data_referencia", nullable = false)
    private LocalDate dataReferencia;

    @Column(name = "valor", nullable = false, precision = 15, scale = 2)
    private BigDecimal valor = BigDecimal.ZERO;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private LocalDateTime criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private LocalDateTime atualizadoEm;
}
