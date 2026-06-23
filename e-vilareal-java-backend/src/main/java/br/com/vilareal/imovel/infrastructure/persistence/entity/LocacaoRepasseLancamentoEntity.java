package br.com.vilareal.imovel.infrastructure.persistence.entity;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.imovel.domain.PapelReconciliacao;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Vínculo entre um ciclo de locação e um lançamento real do caixa ({@code financeiro_lancamento}).
 * Substitui as FKs únicas antigas como fonte do cálculo de resultado (ver {@code V112}).
 */
@Entity
@Table(name = "locacao_repasse_lancamento")
@Getter
@Setter
public class LocacaoRepasseLancamentoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contrato_locacao_id", nullable = false)
    private ContratoLocacaoEntity contratoLocacao;

    /** Competência (AAAA-MM) do ciclo; independe da data bancária do lançamento. */
    @Column(name = "competencia_mes", length = 7)
    private String competenciaMes;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lancamento_financeiro_id", nullable = false)
    private LancamentoFinanceiroEntity lancamentoFinanceiro;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PapelReconciliacao papel;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal valor;

    /** {@code AUTO} = vínculo criado pela conciliação automática pós-import Cora; {@code null} = manual. */
    @Column(length = 20)
    private String origem;

    /** Rótulo livre escolhido na classificação manual (ex.: IPTU, condomínio, outros). */
    @Column(name = "rotulo_classificacao", length = 120)
    private String rotuloClassificacao;

    /**
     * FK real (self-ref) do repasse interno → vínculo de ALUGUEL que o originou (V115). Só populado
     * em vínculos {@code papel=REPASSE} gerados automaticamente (imóvel próprio). É a fonte de
     * idempotência/reversão do repasse interno; {@code numero_lancamento} vira apenas rótulo.
     * {@code ON DELETE SET NULL} no banco: a remoção do par é feita no código, não em cascata.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "origem_aluguel_vinculo_id")
    private LocacaoRepasseLancamentoEntity origemAluguelVinculo;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
