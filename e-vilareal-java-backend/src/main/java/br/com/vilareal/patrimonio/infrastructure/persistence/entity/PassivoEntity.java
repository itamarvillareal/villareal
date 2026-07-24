package br.com.vilareal.patrimonio.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "patrimonio_passivo")
@Getter
@Setter
public class PassivoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String tipo;

    @Column(nullable = false, length = 200)
    private String credor;

    @Column(length = 255)
    private String descricao;

    @Column(name = "valor_original", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorOriginal;

    @Column(name = "saldo_devedor", nullable = false, precision = 19, scale = 2)
    private BigDecimal saldoDevedor;

    @Column(name = "sistema_amortizacao", nullable = false, length = 20)
    private String sistemaAmortizacao;

    @Column(name = "taxa_juros_nominal_aa", precision = 12, scale = 6)
    private BigDecimal taxaJurosNominalAa;

    @Column(name = "cet_efetivo_aa", nullable = false, precision = 12, scale = 6)
    private BigDecimal cetEfetivoAa;

    @Column(length = 30)
    private String indexador;

    @Column(name = "parcela_atual", nullable = false, precision = 19, scale = 2)
    private BigDecimal parcelaAtual;

    @Column(name = "prazo_remanescente_meses", nullable = false)
    private Integer prazoRemanescenteMeses;

    @Column(name = "dia_vencimento")
    private Integer diaVencimento;

    @Column(name = "seguro_mip_mensal", nullable = false, precision = 19, scale = 2)
    private BigDecimal seguroMipMensal = BigDecimal.ZERO;

    @Column(name = "seguro_dfi_mensal", nullable = false, precision = 19, scale = 2)
    private BigDecimal seguroDfiMensal = BigDecimal.ZERO;

    @Column(name = "taxa_administracao_mensal", nullable = false, precision = 19, scale = 2)
    private BigDecimal taxaAdministracaoMensal = BigDecimal.ZERO;

    @Column(name = "taxa_administracao_total", precision = 19, scale = 2)
    private BigDecimal taxaAdministracaoTotal;

    @Column(name = "fundo_reserva", precision = 19, scale = 2)
    private BigDecimal fundoReserva;

    @Column(name = "consorcio_contemplado")
    private Boolean consorcioContemplado;

    @Column(name = "credito_consorcio", precision = 19, scale = 2)
    private BigDecimal creditoConsorcio;

    @Column(name = "permite_reduzir_prazo", nullable = false)
    private Boolean permiteReduzirPrazo = true;

    @Column(name = "permite_reduzir_parcela", nullable = false)
    private Boolean permiteReduzirParcela = true;

    @Column(name = "carencia_amortizacao_dias")
    private Integer carenciaAmortizacaoDias;

    @Column(name = "multa_amortizacao", precision = 12, scale = 6)
    private BigDecimal multaAmortizacao;

    @Column(name = "desconto_juros_futuros", nullable = false)
    private Boolean descontoJurosFuturos = true;

    @Column(name = "bem_vinculado_tipo", length = 30)
    private String bemVinculadoTipo;

    @Column(name = "bem_vinculado_id")
    private Long bemVinculadoId;

    @Column(name = "data_inicio")
    private LocalDate dataInicio;

    @Column(name = "data_fim_prevista")
    private LocalDate dataFimPrevista;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(length = 1000)
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
        if (seguroMipMensal == null) seguroMipMensal = BigDecimal.ZERO;
        if (seguroDfiMensal == null) seguroDfiMensal = BigDecimal.ZERO;
        if (taxaAdministracaoMensal == null) taxaAdministracaoMensal = BigDecimal.ZERO;
        if (permiteReduzirPrazo == null) permiteReduzirPrazo = true;
        if (permiteReduzirParcela == null) permiteReduzirParcela = true;
        if (descontoJurosFuturos == null) descontoJurosFuturos = true;
        if (ativo == null) ativo = true;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
