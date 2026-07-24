package br.com.vilareal.patrimonio.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "patrimonio_parametro")
@Getter
@Setter
public class ParametroEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer versao;

    @Column(name = "vigente_desde", nullable = false)
    private Instant vigenteDesde;

    @Column(name = "vigente_ate")
    private Instant vigenteAte;

    @Column(name = "piso_reserva_meses", nullable = false, precision = 6, scale = 2)
    private BigDecimal pisoReservaMeses = new BigDecimal("6.00");

    @Column(name = "alavancagem_alerta", nullable = false, precision = 8, scale = 4)
    private BigDecimal alavancagemAlerta = new BigDecimal("0.4000");

    @Column(name = "alavancagem_critico", nullable = false, precision = 8, scale = 4)
    private BigDecimal alavancagemCritico = new BigDecimal("0.5500");

    @Column(name = "comprometimento_renda_max", nullable = false, precision = 8, scale = 4)
    private BigDecimal comprometimentoRendaMax = new BigDecimal("0.3000");

    @Column(name = "banda_rebalanceamento_pp", nullable = false, precision = 6, scale = 2)
    private BigDecimal bandaRebalanceamentoPp = new BigDecimal("5.00");

    @Column(name = "reflexao_minimo_parcelas", nullable = false, precision = 6, scale = 2)
    private BigDecimal reflexaoMinimoParcelas = new BigDecimal("1.00");

    @Column(name = "reflexao_horas", nullable = false)
    private Integer reflexaoHoras = 48;

    @Column(name = "teto_amortizacao_anual", precision = 19, scale = 2)
    private BigDecimal tetoAmortizacaoAnual;

    @Column(name = "objetivo_amortizacao", nullable = false, length = 20)
    private String objetivoAmortizacao = "REDUZIR_PRAZO";

    @Column(name = "taxa_referencia_liquida_aa", precision = 12, scale = 6)
    private BigDecimal taxaReferenciaLiquidaAa;

    @Column(name = "taxa_referencia_atualizada_em")
    private Instant taxaReferenciaAtualizadaEm;

    @Column(name = "taxa_referencia_stale_dias", nullable = false)
    private Integer taxaReferenciaStaleDias = 30;

    @Column(name = "renda_mensal_recorrente", precision = 19, scale = 2)
    private BigDecimal rendaMensalRecorrente;

    @Column(name = "meta_alocacao_rv", precision = 8, scale = 4)
    private BigDecimal metaAlocacaoRv;

    @Column(name = "meta_alocacao_rf", precision = 8, scale = 4)
    private BigDecimal metaAlocacaoRf;

    @Column(name = "meta_alocacao_imoveis", precision = 8, scale = 4)
    private BigDecimal metaAlocacaoImoveis;

    @Column(name = "meta_alocacao_caixa", precision = 8, scale = 4)
    private BigDecimal metaAlocacaoCaixa;

    @Column(name = "despesas_fixas_mensais", precision = 19, scale = 2)
    private BigDecimal despesasFixasMensais;

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
