package br.com.vilareal.patrimonio.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "patrimonio_passivo_parcela")
@Getter
@Setter
public class PassivoParcelaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "passivo_id", nullable = false)
    private Long passivoId;

    @Column(nullable = false)
    private Integer numero;

    @Column(name = "data_vencimento", nullable = false)
    private LocalDate dataVencimento;

    @Column(name = "valor_parcela", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorParcela;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amortizacao = BigDecimal.ZERO;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal juros = BigDecimal.ZERO;

    @Column(name = "seguros_taxas", nullable = false, precision = 19, scale = 2)
    private BigDecimal segurosTaxas = BigDecimal.ZERO;

    @Column(name = "saldo_apos", nullable = false, precision = 19, scale = 2)
    private BigDecimal saldoApos = BigDecimal.ZERO;

    @Column(nullable = false, length = 20)
    private String status = "PENDENTE";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
