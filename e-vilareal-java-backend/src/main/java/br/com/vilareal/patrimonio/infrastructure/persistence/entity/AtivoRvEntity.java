package br.com.vilareal.patrimonio.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "patrimonio_ativo_rv")
@Getter
@Setter
public class AtivoRvEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String ticker;

    @Column(nullable = false, precision = 19, scale = 8)
    private BigDecimal quantidade = BigDecimal.ZERO;

    @Column(name = "preco_medio", nullable = false, precision = 19, scale = 6)
    private BigDecimal precoMedio = BigDecimal.ZERO;

    @Column(name = "preco_atual", precision = 19, scale = 6)
    private BigDecimal precoAtual;

    @Column(name = "estrategia_id")
    private Long estrategiaId;

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
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public BigDecimal valorMercado() {
        BigDecimal preco = precoAtual != null ? precoAtual : precoMedio;
        return quantidade.multiply(preco).setScale(2, java.math.RoundingMode.HALF_UP);
    }
}
