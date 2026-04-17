package br.com.vilareal.processo.infrastructure.persistence.entity;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "processo")
@Getter
@Setter
public class ProcessoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pessoa_id", nullable = false)
    private PessoaEntity pessoa;

    @Column(name = "numero_interno", nullable = false)
    private Integer numeroInterno;

    /** Código da unidade (ex.: condomínio A-0103), independente do cadastro de imóvel. */
    @Column(name = "unidade", length = 32)
    private String unidade;

    /** UUID da importação (PDF/XLS) que criou este processo; usado na reversão. */
    @Column(name = "importacao_id", length = 36)
    private String importacaoId;

    @Column(name = "numero_cnj", length = 100)
    private String numeroCnj;

    @Column(name = "numero_processo_antigo", length = 100)
    private String numeroProcessoAntigo;

    @Column(name = "natureza_acao", length = 255)
    private String naturezaAcao;

    @Column(name = "descricao_acao", columnDefinition = "TEXT")
    private String descricaoAcao;

    @Column(length = 120)
    private String competencia;

    @Column(length = 120)
    private String fase;

    @Column(name = "observacao_fase", columnDefinition = "TEXT")
    private String observacaoFase;

    @Column(length = 120)
    private String status;

    @Column(length = 120)
    private String tramitacao;

    @Column(name = "data_protocolo")
    private LocalDate dataProtocolo;

    @Column(name = "prazo_fatal")
    private LocalDate prazoFatal;

    @Column(name = "proxima_consulta")
    private LocalDate proximaConsulta;

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @Column(name = "valor_causa", precision = 19, scale = 2)
    private BigDecimal valorCausa;

    @Column(length = 2)
    private String uf;

    @Column(length = 120)
    private String cidade;

    @Column(name = "consulta_automatica", nullable = false)
    private Boolean consultaAutomatica = false;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(length = 255)
    private String consultor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_responsavel_id")
    private UsuarioEntity usuarioResponsavel;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    /** Valor gravado quando {@link #fase} não veio definida (API, importação ou legado). */
    public static final String FASE_PADRAO_EM_ANDAMENTO = "Em Andamento";

    @PrePersist
    @PreUpdate
    private void garantirFaseProcessualPadrao() {
        if (fase == null || fase.trim().isEmpty()) {
            fase = FASE_PADRAO_EM_ANDAMENTO;
        }
    }
}
