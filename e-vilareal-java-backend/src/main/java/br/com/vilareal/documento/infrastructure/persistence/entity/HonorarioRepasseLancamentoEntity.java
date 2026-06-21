package br.com.vilareal.documento.infrastructure.persistence.entity;

import br.com.vilareal.documento.domain.PapelHonorarioRepasse;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "honorario_repasse_lancamento")
@Getter
@Setter
public class HonorarioRepasseLancamentoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contrato_honorarios_id", nullable = false)
    private ContratoHonorariosEntity contratoHonorarios;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lancamento_financeiro_id", nullable = false)
    private LancamentoFinanceiroEntity lancamentoFinanceiro;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PapelHonorarioRepasse papel;

    @Column(name = "data_referencia")
    private LocalDate dataReferencia;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal valor;

    /** Vínculo ALVARA ao qual este REPASSE se refere (somente {@code papel=REPASSE}). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "alvara_vinculo_id")
    private HonorarioRepasseLancamentoEntity alvaraVinculo;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
