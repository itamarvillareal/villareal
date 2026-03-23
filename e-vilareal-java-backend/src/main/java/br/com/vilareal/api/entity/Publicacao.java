package br.com.vilareal.api.entity;

import br.com.vilareal.api.entity.enums.PublicacaoOrigemImportacao;
import br.com.vilareal.api.entity.enums.PublicacaoStatusTratamento;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "publicacoes", indexes = {
        @Index(name = "idx_publicacoes_numero_processo", columnList = "numero_processo_encontrado"),
        @Index(name = "idx_publicacoes_data_publicacao", columnList = "data_publicacao"),
        @Index(name = "idx_publicacoes_status_tratamento", columnList = "status_tratamento"),
        @Index(name = "idx_publicacoes_origem_importacao", columnList = "origem_importacao"),
        @Index(name = "idx_publicacoes_processo", columnList = "processo_id"),
        @Index(name = "idx_publicacoes_cliente", columnList = "cliente_id"),
        @Index(name = "idx_publicacoes_usuario", columnList = "usuario_responsavel_id"),
        @Index(name = "idx_publicacoes_monitoring_hit", columnList = "monitoring_hit_id")
})
public class Publicacao {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "numero_processo_encontrado", nullable = false, length = 32)
    private String numeroProcessoEncontrado;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id", foreignKey = @ForeignKey(name = "fk_publicacoes_processo"))
    private Processo processo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", foreignKey = @ForeignKey(name = "fk_publicacoes_cliente"))
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_responsavel_id", foreignKey = @ForeignKey(name = "fk_publicacoes_usuario"))
    private Usuario usuarioResponsavel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "monitoring_hit_id", foreignKey = @ForeignKey(name = "fk_publicacoes_monitoring_hit"))
    private MonitoringHit monitoringHit;

    @Column(name = "data_disponibilizacao")
    private LocalDate dataDisponibilizacao;

    @Column(name = "data_publicacao")
    private LocalDate dataPublicacao;

    @Column(length = 120)
    private String fonte;

    @Column(length = 200)
    private String diario;

    @Column(length = 80)
    private String edicao;

    @Column(length = 120)
    private String caderno;

    @Column(length = 40)
    private String pagina;

    @Column(length = 255)
    private String titulo;

    @Column(name = "tipo_publicacao", length = 80)
    private String tipoPublicacao;

    @Column(columnDefinition = "TEXT")
    private String resumo;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String teor;

    @Column(name = "status_validacao_cnj", length = 40)
    private String statusValidacaoCnj;

    @Column(name = "score_confianca", length = 16)
    private String scoreConfianca;

    @Column(name = "hash_teor", nullable = false, length = 128)
    private String hashTeor;

    @Column(name = "hash_conteudo", nullable = false, unique = true, length = 128)
    private String hashConteudo;

    @Enumerated(EnumType.STRING)
    @Column(name = "origem_importacao", nullable = false, length = 40)
    private PublicacaoOrigemImportacao origemImportacao = PublicacaoOrigemImportacao.MANUAL;

    @Column(name = "arquivo_origem_nome", length = 255)
    private String arquivoOrigemNome;

    @Column(name = "arquivo_origem_hash", length = 128)
    private String arquivoOrigemHash;

    @Column(name = "json_referencia", columnDefinition = "LONGTEXT")
    private String jsonReferencia;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_tratamento", nullable = false, length = 30)
    private PublicacaoStatusTratamento statusTratamento = PublicacaoStatusTratamento.PENDENTE;

    @Column(nullable = false)
    private Boolean lida = false;

    @Column(name = "lida_em")
    private LocalDateTime lidaEm;

    @Column(name = "tratada_em")
    private LocalDateTime tratadaEm;

    @Column(name = "ignorada_em")
    private LocalDateTime ignoradaEm;

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNumeroProcessoEncontrado() { return numeroProcessoEncontrado; }
    public void setNumeroProcessoEncontrado(String numeroProcessoEncontrado) { this.numeroProcessoEncontrado = numeroProcessoEncontrado; }
    public Processo getProcesso() { return processo; }
    public void setProcesso(Processo processo) { this.processo = processo; }
    public Cliente getCliente() { return cliente; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }
    public Usuario getUsuarioResponsavel() { return usuarioResponsavel; }
    public void setUsuarioResponsavel(Usuario usuarioResponsavel) { this.usuarioResponsavel = usuarioResponsavel; }
    public MonitoringHit getMonitoringHit() { return monitoringHit; }
    public void setMonitoringHit(MonitoringHit monitoringHit) { this.monitoringHit = monitoringHit; }
    public LocalDate getDataDisponibilizacao() { return dataDisponibilizacao; }
    public void setDataDisponibilizacao(LocalDate dataDisponibilizacao) { this.dataDisponibilizacao = dataDisponibilizacao; }
    public LocalDate getDataPublicacao() { return dataPublicacao; }
    public void setDataPublicacao(LocalDate dataPublicacao) { this.dataPublicacao = dataPublicacao; }
    public String getFonte() { return fonte; }
    public void setFonte(String fonte) { this.fonte = fonte; }
    public String getDiario() { return diario; }
    public void setDiario(String diario) { this.diario = diario; }
    public String getEdicao() { return edicao; }
    public void setEdicao(String edicao) { this.edicao = edicao; }
    public String getCaderno() { return caderno; }
    public void setCaderno(String caderno) { this.caderno = caderno; }
    public String getPagina() { return pagina; }
    public void setPagina(String pagina) { this.pagina = pagina; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getTipoPublicacao() { return tipoPublicacao; }
    public void setTipoPublicacao(String tipoPublicacao) { this.tipoPublicacao = tipoPublicacao; }
    public String getResumo() { return resumo; }
    public void setResumo(String resumo) { this.resumo = resumo; }
    public String getTeor() { return teor; }
    public void setTeor(String teor) { this.teor = teor; }
    public String getStatusValidacaoCnj() { return statusValidacaoCnj; }
    public void setStatusValidacaoCnj(String statusValidacaoCnj) { this.statusValidacaoCnj = statusValidacaoCnj; }
    public String getScoreConfianca() { return scoreConfianca; }
    public void setScoreConfianca(String scoreConfianca) { this.scoreConfianca = scoreConfianca; }
    public String getHashTeor() { return hashTeor; }
    public void setHashTeor(String hashTeor) { this.hashTeor = hashTeor; }
    public String getHashConteudo() { return hashConteudo; }
    public void setHashConteudo(String hashConteudo) { this.hashConteudo = hashConteudo; }
    public PublicacaoOrigemImportacao getOrigemImportacao() { return origemImportacao; }
    public void setOrigemImportacao(PublicacaoOrigemImportacao origemImportacao) { this.origemImportacao = origemImportacao; }
    public String getArquivoOrigemNome() { return arquivoOrigemNome; }
    public void setArquivoOrigemNome(String arquivoOrigemNome) { this.arquivoOrigemNome = arquivoOrigemNome; }
    public String getArquivoOrigemHash() { return arquivoOrigemHash; }
    public void setArquivoOrigemHash(String arquivoOrigemHash) { this.arquivoOrigemHash = arquivoOrigemHash; }
    public String getJsonReferencia() { return jsonReferencia; }
    public void setJsonReferencia(String jsonReferencia) { this.jsonReferencia = jsonReferencia; }
    public PublicacaoStatusTratamento getStatusTratamento() { return statusTratamento; }
    public void setStatusTratamento(PublicacaoStatusTratamento statusTratamento) { this.statusTratamento = statusTratamento; }
    public Boolean getLida() { return lida; }
    public void setLida(Boolean lida) { this.lida = lida; }
    public LocalDateTime getLidaEm() { return lidaEm; }
    public void setLidaEm(LocalDateTime lidaEm) { this.lidaEm = lidaEm; }
    public LocalDateTime getTratadaEm() { return tratadaEm; }
    public void setTratadaEm(LocalDateTime tratadaEm) { this.tratadaEm = tratadaEm; }
    public LocalDateTime getIgnoradaEm() { return ignoradaEm; }
    public void setIgnoradaEm(LocalDateTime ignoradaEm) { this.ignoradaEm = ignoradaEm; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
