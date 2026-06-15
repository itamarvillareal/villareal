package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * Conta bancária como entidade (V116, Fase 3 item 3 — FASE A). Antes, {@code numero_banco}/
 * {@code banco_nome} eram denormalizados em cada {@code financeiro_lancamento} e o caráter
 * real/manual/virtual era só convenção. Esta entidade materializa isso.
 *
 * <p>FASE A: a tabela é populada e ligada por FK, mas NÃO dirige comportamento ainda — service e
 * frontend continuam lendo {@code numero_banco}/{@code banco_nome} do lançamento (Fase B muda isso).
 */
@Entity
@Table(name = "conta_bancaria")
@Getter
@Setter
public class ContaBancariaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nº do consolidado/extrato (mesma convenção de {@code financeiro_lancamento.numero_banco}). */
    @Column(name = "numero_banco", nullable = false, unique = true)
    private Integer numeroBanco;

    @Column(name = "banco_nome", length = 120)
    private String bancoNome;

    /** REAL (com extrato) | MANUAL (lançamentos manuais) | VIRTUAL (repasse interno 900). */
    @Column(nullable = false, length = 20)
    private String tipo;

    @Column(name = "tem_extrato", nullable = false)
    private Boolean temExtrato;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
