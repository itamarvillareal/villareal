package br.com.vilareal.imovel.infrastructure.persistence.entity;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "contrato_locacao")
@Getter
@Setter
public class ContratoLocacaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "imovel_id", nullable = false)
    private ImovelEntity imovel;

    /** Par Cod.+Proc. ao qual este contrato/locatário pertence. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "locador_pessoa_id")
    private PessoaEntity locadorPessoa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inquilino_pessoa_id")
    private PessoaEntity inquilinoPessoa;

    @Column(name = "data_inicio")
    private LocalDate dataInicio;

    @Column(name = "data_fim")
    private LocalDate dataFim;

    @Column(name = "valor_aluguel", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorAluguel;

    @Column(name = "valor_repasse_pactuado", precision = 19, scale = 2)
    private BigDecimal valorRepassePactuado;

    @Column(name = "dia_vencimento_aluguel")
    private Integer diaVencimentoAluguel;

    /** {@code DEPOSITO_TED} ou {@code BOLETO} — Cláusula 3ª do contrato. */
    @Column(name = "forma_pagamento_aluguel", length = 40)
    private String formaPagamentoAluguel;

    @Column(name = "dia_repasse")
    private Integer diaRepasse;

    /** Taxa de administração (% sobre o aluguel recebido) usada como EXPECTATIVA no resultado. */
    @Column(name = "taxa_administracao_percent", precision = 5, scale = 2)
    private BigDecimal taxaAdministracaoPercent = new BigDecimal("10.00");

    @Column(name = "garantia_tipo", length = 120)
    private String garantiaTipo;

    @Column(name = "valor_garantia", precision = 19, scale = 2)
    private BigDecimal valorGarantia;

    @Column(name = "dados_bancarios_repasse_json", columnDefinition = "TEXT")
    private String dadosBancariosRepasseJson;

    /** JSON: [{"pessoaId":123}, ...] */
    @Column(name = "fiadores_json", columnDefinition = "TEXT")
    private String fiadoresJson;

    /** JSON: [{"pessoaId":123}, ...] — locatários adicionais; FK inquilino_pessoa_id = primeiro da lista. */
    @Column(name = "inquilinos_json", columnDefinition = "TEXT")
    private String inquilinosJson;

    @Column(nullable = false, length = 40)
    private String status = "RASCUNHO";

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
