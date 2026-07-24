package br.com.vilareal.patrimonio.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "patrimonio_operacao_opcao")
@Getter
@Setter
public class OperacaoOpcaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticker_ativo", nullable = false, length = 20)
    private String tickerAtivo;

    @Column(name = "ticker_opcao", length = 30)
    private String tickerOpcao;

    @Column(nullable = false, length = 30)
    private String tipo;

    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal strike;

    @Column(nullable = false)
    private LocalDate vencimento;

    @Column(nullable = false)
    private Integer quantidade = 1;

    @Column(name = "premio_estimado", precision = 19, scale = 6)
    private BigDecimal premioEstimado;

    @Column(name = "premio_realizado", precision = 19, scale = 6)
    private BigDecimal premioRealizado;

    @Column(name = "premio_pago_recebido", nullable = false, precision = 19, scale = 2)
    private BigDecimal premioPagoRecebido = BigDecimal.ZERO;

    @Column(name = "margem_exigida", nullable = false, precision = 19, scale = 2)
    private BigDecimal margemExigida = BigDecimal.ZERO;

    @Column(nullable = false, length = 20)
    private String status = "ABERTA";

    @Column(name = "estrategia_id")
    private Long estrategiaId;

    @Column(name = "data_abertura", nullable = false)
    private LocalDate dataAbertura;

    @Column(name = "data_encerramento")
    private LocalDate dataEncerramento;

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
}
