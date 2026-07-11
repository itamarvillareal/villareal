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

    /** Código FID/BANKID do OFX (ex.: 756 = Sicoob). */
    @Column(name = "ofx_bank_id", length = 10)
    private String ofxBankId;

    /** Agência conforme tag BRANCHID do OFX. */
    @Column(name = "ofx_agencia", length = 20)
    private String ofxAgencia;

    /** Conta conforme tag ACCTID do OFX. */
    @Column(name = "ofx_conta", length = 30)
    private String ofxConta;

    /** REAL (com extrato) | MANUAL (lançamentos manuais) | VIRTUAL (repasse interno 900). */
    @Column(nullable = false, length = 20)
    private String tipo;

    @Column(name = "tem_extrato", nullable = false)
    private Boolean temExtrato;

    @Column(nullable = false)
    private Boolean ativo = true;

    /**
     * Conta de acerto (CONTA ZERO, V203): grupos de compensação devem somar exatamente 0 com o
     * mesmo vínculo; lançamentos sem grupo são pendências (alerta enquanto a conta não zera).
     */
    @Column(name = "exige_soma_zero", nullable = false)
    private Boolean exigeSomaZero = false;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
