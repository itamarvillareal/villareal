package br.com.vilareal.patrimonio.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "patrimonio_amortizacao")
@Getter
@Setter
public class AmortizacaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "passivo_id", nullable = false)
    private Long passivoId;

    @Column(name = "data_solicitacao", nullable = false)
    private Instant dataSolicitacao;

    @Column(name = "data_efetivacao")
    private Instant dataEfetivacao;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal valor;

    @Column(nullable = false, length = 20)
    private String modalidade;

    @Column(nullable = false, length = 30)
    private String status = "RASCUNHO";

    @Column(nullable = false, length = 30)
    private String origem = "SOLICITACAO";

    @Lob
    private String racional;

    @Column(name = "justificativa_reserva", columnDefinition = "TEXT")
    private String justificativaReserva;

    @Column(name = "justificativa_teto", columnDefinition = "TEXT")
    private String justificativaTeto;

    @Column(name = "ultrapassou_teto", nullable = false)
    private Boolean ultrapassouTeto = false;

    @Column(name = "cet_vigente_aa", precision = 12, scale = 6)
    private BigDecimal cetVigenteAa;

    @Column(name = "retorno_alternativa_aa", precision = 12, scale = 6)
    private BigDecimal retornoAlternativaAa;

    @Column(name = "diferencial_pp", precision = 12, scale = 6)
    private BigDecimal diferencialPp;

    @Column(name = "economia_vp", precision = 19, scale = 2)
    private BigDecimal economiaVp;

    @Column(name = "valor_nominal_eliminado", precision = 19, scale = 2)
    private BigDecimal valorNominalEliminado;

    @Column(name = "meses_eliminados")
    private Integer mesesEliminados;

    @Column(name = "taxa_implicita_aa", precision = 12, scale = 6)
    private BigDecimal taxaImplicitaAa;

    @Column(name = "impacto_pl_12m", precision = 19, scale = 2)
    private BigDecimal impactoPl12m;

    @Column(name = "impacto_pl_36m", precision = 19, scale = 2)
    private BigDecimal impactoPl36m;

    @Column(length = 40)
    private String recomendacao;

    @Column(name = "pendente_ate")
    private Instant pendenteAte;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (dataSolicitacao == null) dataSolicitacao = now;
        if (origem == null) origem = "SOLICITACAO";
        if (ultrapassouTeto == null) ultrapassouTeto = false;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
