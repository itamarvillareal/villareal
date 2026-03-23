package br.com.vilareal.api.entity;

import br.com.vilareal.api.entity.enums.LancamentoNatureza;
import br.com.vilareal.api.entity.enums.LancamentoOrigem;
import br.com.vilareal.api.entity.enums.LancamentoStatus;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "lancamentos_financeiros", indexes = {
        @Index(name = "idx_lanc_fin_data_lancamento", columnList = "data_lancamento"),
        @Index(name = "idx_lanc_fin_data_competencia", columnList = "data_competencia"),
        @Index(name = "idx_lanc_fin_cliente_id", columnList = "cliente_id"),
        @Index(name = "idx_lanc_fin_processo_id", columnList = "processo_id"),
        @Index(name = "idx_lanc_fin_conta_id", columnList = "conta_contabil_id"),
        @Index(name = "idx_lanc_fin_classificacao_id", columnList = "classificacao_financeira_id"),
        @Index(name = "idx_lanc_fin_elo_id", columnList = "elo_financeiro_id"),
        @Index(name = "idx_lanc_fin_natureza", columnList = "natureza"),
        @Index(name = "idx_lanc_fin_status", columnList = "status"),
        @Index(name = "idx_lanc_fin_origem", columnList = "origem")
})
public class LancamentoFinanceiro {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conta_contabil_id", nullable = false, foreignKey = @ForeignKey(name = "fk_lanc_fin_conta_contabil"))
    private ContaContabil contaContabil;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classificacao_financeira_id", foreignKey = @ForeignKey(name = "fk_lanc_fin_classificacao"))
    private ClassificacaoFinanceira classificacaoFinanceira;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elo_financeiro_id", foreignKey = @ForeignKey(name = "fk_lanc_fin_elo"))
    private EloFinanceiro eloFinanceiro;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", foreignKey = @ForeignKey(name = "fk_lanc_fin_cliente"))
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id", foreignKey = @ForeignKey(name = "fk_lanc_fin_processo"))
    private Processo processo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", foreignKey = @ForeignKey(name = "fk_lanc_fin_usuario"))
    private Usuario usuario;

    @Column(name = "banco_nome", length = 120)
    private String bancoNome;

    @Column(name = "numero_banco")
    private Integer numeroBanco;

    @Column(name = "numero_lancamento", nullable = false, length = 50)
    private String numeroLancamento;

    @Column(name = "data_lancamento", nullable = false)
    private LocalDate dataLancamento;

    @Column(name = "data_competencia")
    private LocalDate dataCompetencia;

    @Column(nullable = false, length = 500)
    private String descricao;

    @Column(name = "descricao_detalhada", columnDefinition = "TEXT")
    private String descricaoDetalhada;

    @Column(name = "documento_referencia", length = 120)
    private String documentoReferencia;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal valor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LancamentoNatureza natureza;

    @Column(name = "ref_tipo", nullable = false, length = 1)
    private String refTipo = "N";

    @Column(name = "eq_referencia", length = 120)
    private String eqReferencia;

    @Column(name = "parcela_ref", length = 30)
    private String parcelaRef;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LancamentoStatus status = LancamentoStatus.ATIVO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private LancamentoOrigem origem = LancamentoOrigem.MANUAL;

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @Column(name = "metadados_json", columnDefinition = "json")
    private String metadadosJson;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ContaContabil getContaContabil() { return contaContabil; }
    public void setContaContabil(ContaContabil contaContabil) { this.contaContabil = contaContabil; }
    public ClassificacaoFinanceira getClassificacaoFinanceira() { return classificacaoFinanceira; }
    public void setClassificacaoFinanceira(ClassificacaoFinanceira classificacaoFinanceira) { this.classificacaoFinanceira = classificacaoFinanceira; }
    public EloFinanceiro getEloFinanceiro() { return eloFinanceiro; }
    public void setEloFinanceiro(EloFinanceiro eloFinanceiro) { this.eloFinanceiro = eloFinanceiro; }
    public Cliente getCliente() { return cliente; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }
    public Processo getProcesso() { return processo; }
    public void setProcesso(Processo processo) { this.processo = processo; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public String getBancoNome() { return bancoNome; }
    public void setBancoNome(String bancoNome) { this.bancoNome = bancoNome; }
    public Integer getNumeroBanco() { return numeroBanco; }
    public void setNumeroBanco(Integer numeroBanco) { this.numeroBanco = numeroBanco; }
    public String getNumeroLancamento() { return numeroLancamento; }
    public void setNumeroLancamento(String numeroLancamento) { this.numeroLancamento = numeroLancamento; }
    public LocalDate getDataLancamento() { return dataLancamento; }
    public void setDataLancamento(LocalDate dataLancamento) { this.dataLancamento = dataLancamento; }
    public LocalDate getDataCompetencia() { return dataCompetencia; }
    public void setDataCompetencia(LocalDate dataCompetencia) { this.dataCompetencia = dataCompetencia; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public String getDescricaoDetalhada() { return descricaoDetalhada; }
    public void setDescricaoDetalhada(String descricaoDetalhada) { this.descricaoDetalhada = descricaoDetalhada; }
    public String getDocumentoReferencia() { return documentoReferencia; }
    public void setDocumentoReferencia(String documentoReferencia) { this.documentoReferencia = documentoReferencia; }
    public BigDecimal getValor() { return valor; }
    public void setValor(BigDecimal valor) { this.valor = valor; }
    public LancamentoNatureza getNatureza() { return natureza; }
    public void setNatureza(LancamentoNatureza natureza) { this.natureza = natureza; }
    public String getRefTipo() { return refTipo; }
    public void setRefTipo(String refTipo) { this.refTipo = refTipo; }
    public String getEqReferencia() { return eqReferencia; }
    public void setEqReferencia(String eqReferencia) { this.eqReferencia = eqReferencia; }
    public String getParcelaRef() { return parcelaRef; }
    public void setParcelaRef(String parcelaRef) { this.parcelaRef = parcelaRef; }
    public LancamentoStatus getStatus() { return status; }
    public void setStatus(LancamentoStatus status) { this.status = status; }
    public LancamentoOrigem getOrigem() { return origem; }
    public void setOrigem(LancamentoOrigem origem) { this.origem = origem; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public String getMetadadosJson() { return metadadosJson; }
    public void setMetadadosJson(String metadadosJson) { this.metadadosJson = metadadosJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
