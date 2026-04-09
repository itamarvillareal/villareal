package br.com.vilareal.imovel.infrastructure.persistence.entity;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "locador_pessoa_id")
    private PessoaEntity locadorPessoa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inquilino_pessoa_id")
    private PessoaEntity inquilinoPessoa;

    @Column(name = "data_inicio", nullable = false)
    private LocalDate dataInicio;

    @Column(name = "data_fim")
    private LocalDate dataFim;

    @Column(name = "valor_aluguel", nullable = false, precision = 19, scale = 2)
    private BigDecimal valorAluguel;

    @Column(name = "valor_repasse_pactuado", precision = 19, scale = 2)
    private BigDecimal valorRepassePactuado;

    @Column(name = "dia_vencimento_aluguel")
    private Integer diaVencimentoAluguel;

    @Column(name = "dia_repasse")
    private Integer diaRepasse;

    @Column(name = "garantia_tipo", length = 120)
    private String garantiaTipo;

    @Column(name = "valor_garantia", precision = 19, scale = 2)
    private BigDecimal valorGarantia;

    @Column(name = "dados_bancarios_repasse_json", columnDefinition = "TEXT")
    private String dadosBancariosRepasseJson;

    @Column(nullable = false, length = 40)
    private String status = "RASCUNHO";

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
