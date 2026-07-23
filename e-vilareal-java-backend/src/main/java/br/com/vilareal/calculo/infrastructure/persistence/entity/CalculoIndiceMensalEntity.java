package br.com.vilareal.calculo.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** Valor mensal publicado de um índice econômico (SGS/BCB). Competência no formato {@code yyyy-MM}. */
@Entity
@Table(name = "calculo_indice_mensal")
@Getter
@Setter
public class CalculoIndiceMensalEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nome canônico: INPC, IPCA, IGPM, SELIC, CDI, TR, POUPANCA. */
    @Column(name = "indice", length = 16, nullable = false)
    private String indice;

    @Column(name = "competencia", length = 7, nullable = false)
    private String competencia;

    /** Variação/rentabilidade mensal em % (ex.: 0.42 = 0,42%). */
    @Column(name = "valor", nullable = false, precision = 12, scale = 6)
    private BigDecimal valor;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
