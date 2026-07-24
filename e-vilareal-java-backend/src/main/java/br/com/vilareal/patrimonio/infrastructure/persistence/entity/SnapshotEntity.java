package br.com.vilareal.patrimonio.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "patrimonio_snapshot")
@Getter
@Setter
public class SnapshotEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "data_ref", nullable = false)
    private LocalDate dataRef;

    @Column(name = "ativo_total", nullable = false, precision = 19, scale = 2)
    private BigDecimal ativoTotal = BigDecimal.ZERO;

    @Column(name = "passivo_total", nullable = false, precision = 19, scale = 2)
    private BigDecimal passivoTotal = BigDecimal.ZERO;

    @Column(name = "patrimonio_liquido", nullable = false, precision = 19, scale = 2)
    private BigDecimal patrimonioLiquido = BigDecimal.ZERO;

    @Column(precision = 12, scale = 6)
    private BigDecimal alavancagem;

    @Column(name = "rv_total", nullable = false, precision = 19, scale = 2)
    private BigDecimal rvTotal = BigDecimal.ZERO;

    @Column(name = "rf_total", nullable = false, precision = 19, scale = 2)
    private BigDecimal rfTotal = BigDecimal.ZERO;

    @Column(name = "imoveis_total", nullable = false, precision = 19, scale = 2)
    private BigDecimal imoveisTotal = BigDecimal.ZERO;

    @Column(name = "caixa_total", nullable = false, precision = 19, scale = 2)
    private BigDecimal caixaTotal = BigDecimal.ZERO;

    @Column(name = "caixa_vinculado", nullable = false, precision = 19, scale = 2)
    private BigDecimal caixaVinculado = BigDecimal.ZERO;

    @Column(name = "caixa_livre", nullable = false, precision = 19, scale = 2)
    private BigDecimal caixaLivre = BigDecimal.ZERO;

    @Column(name = "veiculos_total", nullable = false, precision = 19, scale = 2)
    private BigDecimal veiculosTotal = BigDecimal.ZERO;

    @Column(name = "outros_ativos", nullable = false, precision = 19, scale = 2)
    private BigDecimal outrosAtivos = BigDecimal.ZERO;

    @Column(name = "passivo_imobiliario", nullable = false, precision = 19, scale = 2)
    private BigDecimal passivoImobiliario = BigDecimal.ZERO;

    @Column(name = "passivo_veiculo", nullable = false, precision = 19, scale = 2)
    private BigDecimal passivoVeiculo = BigDecimal.ZERO;

    @Column(name = "passivo_consorcio", nullable = false, precision = 19, scale = 2)
    private BigDecimal passivoConsorcio = BigDecimal.ZERO;

    @Column(name = "passivo_credito_pessoal", nullable = false, precision = 19, scale = 2)
    private BigDecimal passivoCreditoPessoal = BigDecimal.ZERO;

    @Column(name = "passivo_cartao", nullable = false, precision = 19, scale = 2)
    private BigDecimal passivoCartao = BigDecimal.ZERO;

    @Column(name = "passivo_outros", nullable = false, precision = 19, scale = 2)
    private BigDecimal passivoOutros = BigDecimal.ZERO;

    @Column(nullable = false, length = 30)
    private String origem = "CALCULO";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
