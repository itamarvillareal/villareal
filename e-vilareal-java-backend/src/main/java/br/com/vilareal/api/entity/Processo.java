package br.com.vilareal.api.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "processos", uniqueConstraints = {
        @UniqueConstraint(name = "uk_processos_cliente_numero_interno", columnNames = {"cliente_id", "numero_interno"})
}, indexes = {
        @Index(name = "idx_processos_cliente_id", columnList = "cliente_id"),
        @Index(name = "idx_processos_numero_cnj", columnList = "numero_cnj"),
        @Index(name = "idx_processos_ativo", columnList = "ativo"),
        @Index(name = "idx_processos_prazo_fatal", columnList = "prazo_fatal"),
        @Index(name = "idx_processos_proxima_consulta", columnList = "proxima_consulta")
})
public class Processo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false, foreignKey = @ForeignKey(name = "fk_processos_cliente"))
    private Cliente cliente;

    @Column(name = "numero_interno", nullable = false)
    private Integer numeroInterno;

    @Column(name = "numero_cnj", length = 32)
    private String numeroCnj;

    @Column(name = "numero_processo_antigo", length = 64)
    private String numeroProcessoAntigo;

    @Column(name = "descricao_acao", columnDefinition = "TEXT")
    private String descricaoAcao;

    @Column(name = "natureza_acao", length = 255)
    private String naturezaAcao;

    @Column(length = 120)
    private String competencia;

    @Column(length = 120)
    private String fase;

    @Column(length = 80)
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

    @Column(name = "valor_causa", precision = 15, scale = 2)
    private BigDecimal valorCausa;

    @Column(length = 2)
    private String uf;

    @Column(length = 120)
    private String cidade;

    @Column(length = 160)
    private String comarca;

    @Column(length = 255)
    private String vara;

    @Column(length = 120)
    private String tribunal;

    @Column(name = "consulta_automatica", nullable = false)
    private Boolean consultaAutomatica = false;

    @Column(nullable = false)
    private Boolean ativo = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_responsavel_id", foreignKey = @ForeignKey(name = "fk_processos_usuario_responsavel"))
    private Usuario usuarioResponsavel;

    @Column(length = 255)
    private String consultor;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Cliente getCliente() { return cliente; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }
    public Integer getNumeroInterno() { return numeroInterno; }
    public void setNumeroInterno(Integer numeroInterno) { this.numeroInterno = numeroInterno; }
    public String getNumeroCnj() { return numeroCnj; }
    public void setNumeroCnj(String numeroCnj) { this.numeroCnj = numeroCnj; }
    public String getNumeroProcessoAntigo() { return numeroProcessoAntigo; }
    public void setNumeroProcessoAntigo(String numeroProcessoAntigo) { this.numeroProcessoAntigo = numeroProcessoAntigo; }
    public String getDescricaoAcao() { return descricaoAcao; }
    public void setDescricaoAcao(String descricaoAcao) { this.descricaoAcao = descricaoAcao; }
    public String getNaturezaAcao() { return naturezaAcao; }
    public void setNaturezaAcao(String naturezaAcao) { this.naturezaAcao = naturezaAcao; }
    public String getCompetencia() { return competencia; }
    public void setCompetencia(String competencia) { this.competencia = competencia; }
    public String getFase() { return fase; }
    public void setFase(String fase) { this.fase = fase; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTramitacao() { return tramitacao; }
    public void setTramitacao(String tramitacao) { this.tramitacao = tramitacao; }
    public LocalDate getDataProtocolo() { return dataProtocolo; }
    public void setDataProtocolo(LocalDate dataProtocolo) { this.dataProtocolo = dataProtocolo; }
    public LocalDate getPrazoFatal() { return prazoFatal; }
    public void setPrazoFatal(LocalDate prazoFatal) { this.prazoFatal = prazoFatal; }
    public LocalDate getProximaConsulta() { return proximaConsulta; }
    public void setProximaConsulta(LocalDate proximaConsulta) { this.proximaConsulta = proximaConsulta; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public BigDecimal getValorCausa() { return valorCausa; }
    public void setValorCausa(BigDecimal valorCausa) { this.valorCausa = valorCausa; }
    public String getUf() { return uf; }
    public void setUf(String uf) { this.uf = uf; }
    public String getCidade() { return cidade; }
    public void setCidade(String cidade) { this.cidade = cidade; }
    public String getComarca() { return comarca; }
    public void setComarca(String comarca) { this.comarca = comarca; }
    public String getVara() { return vara; }
    public void setVara(String vara) { this.vara = vara; }
    public String getTribunal() { return tribunal; }
    public void setTribunal(String tribunal) { this.tribunal = tribunal; }
    public Boolean getConsultaAutomatica() { return consultaAutomatica; }
    public void setConsultaAutomatica(Boolean consultaAutomatica) { this.consultaAutomatica = consultaAutomatica; }
    public Boolean getAtivo() { return ativo; }
    public void setAtivo(Boolean ativo) { this.ativo = ativo; }
    public Usuario getUsuarioResponsavel() { return usuarioResponsavel; }
    public void setUsuarioResponsavel(Usuario usuarioResponsavel) { this.usuarioResponsavel = usuarioResponsavel; }
    public String getConsultor() { return consultor; }
    public void setConsultor(String consultor) { this.consultor = consultor; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
