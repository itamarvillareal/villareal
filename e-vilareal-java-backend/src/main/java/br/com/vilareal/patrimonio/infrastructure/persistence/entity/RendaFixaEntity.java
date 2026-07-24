package br.com.vilareal.patrimonio.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "patrimonio_renda_fixa")
@Getter
@Setter
public class RendaFixaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String instrumento;

    @Column(length = 120)
    private String instituicao;

    @Column(name = "valor_aplicado", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorAplicado;

    @Column(name = "valor_atual", precision = 19, scale = 2)
    private BigDecimal valorAtual;

    @Column(length = 30)
    private String indexador;

    @Column(name = "taxa_contratada", precision = 12, scale = 6)
    private BigDecimal taxaContratada;

    private LocalDate vencimento;

    @Column(nullable = false, length = 30)
    private String liquidez = "NO_VENCIMENTO";

    @Column(name = "reserva_emergencia", nullable = false)
    private Boolean reservaEmergencia = false;

    @Column(name = "rentabilidade_bruta_aa", precision = 12, scale = 6)
    private BigDecimal rentabilidadeBrutaAa;

    @Column(name = "rentabilidade_liquida_aa", precision = 12, scale = 6)
    private BigDecimal rentabilidadeLiquidaAa;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(length = 500)
    private String observacao;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (liquidez == null) liquidez = "NO_VENCIMENTO";
        if (reservaEmergencia == null) reservaEmergencia = false;
        if (ativo == null) ativo = true;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public BigDecimal valorParaConsolidacao() {
        return valorAtual != null ? valorAtual : valorAplicado;
    }
}
