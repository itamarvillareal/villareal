package br.com.vilareal.descontocheque.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Desconto de cheque: entidade independente (não vincula cliente/processo).
 * Mapeia a tabela `desconto_cheque` criada manualmente (ddl-auto=validate).
 */
@Entity
@Table(name = "desconto_cheque")
@Getter
@Setter
public class DescontoChequeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 255)
    private String descricao;

    @Column(name = "valor_face", nullable = false, precision = 15, scale = 2)
    private BigDecimal valorFace;

    @Column(name = "data_base", nullable = false)
    private LocalDate dataBase;

    @Column(name = "data_deposito", nullable = false)
    private LocalDate dataDeposito;

    @Column(name = "taxa_mensal_percentual", nullable = false, precision = 9, scale = 4)
    private BigDecimal taxaMensalPercentual;

    @Column(nullable = false)
    private Integer dias;

    @Column(name = "taxa_diaria", nullable = false, precision = 15, scale = 10)
    private BigDecimal taxaDiaria;

    @Column(name = "valor_liquido", nullable = false, precision = 15, scale = 2)
    private BigDecimal valorLiquido;

    @Column(name = "valor_desconto", nullable = false, precision = 15, scale = 2)
    private BigDecimal valorDesconto;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
