package br.com.vilareal.api.entity;

import br.com.vilareal.api.entity.enums.PublicacaoAcaoTratamento;
import br.com.vilareal.api.entity.enums.PublicacaoStatusTratamento;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "publicacoes_tratamentos", indexes = {
        @Index(name = "idx_pub_trat_publicacao", columnList = "publicacao_id,created_at"),
        @Index(name = "idx_pub_trat_status", columnList = "status_novo"),
        @Index(name = "idx_pub_trat_acao", columnList = "acao"),
        @Index(name = "idx_pub_trat_usuario", columnList = "usuario_id")
})
public class PublicacaoTratamento {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "publicacao_id", nullable = false, foreignKey = @ForeignKey(name = "fk_pub_trat_publicacao"))
    private Publicacao publicacao;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_anterior", length = 30)
    private PublicacaoStatusTratamento statusAnterior;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_novo", nullable = false, length = 30)
    private PublicacaoStatusTratamento statusNovo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PublicacaoAcaoTratamento acao;

    @Column(length = 500)
    private String descricao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id", foreignKey = @ForeignKey(name = "fk_pub_trat_processo"))
    private Processo processo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", foreignKey = @ForeignKey(name = "fk_pub_trat_cliente"))
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", foreignKey = @ForeignKey(name = "fk_pub_trat_usuario"))
    private Usuario usuario;

    @Column(name = "andamento_gerado", nullable = false)
    private Boolean andamentoGerado = false;

    @Column(name = "prazo_gerado", nullable = false)
    private Boolean prazoGerado = false;

    @Column(name = "tarefa_gerada", nullable = false)
    private Boolean tarefaGerada = false;

    @Column(name = "metadados_json", columnDefinition = "json")
    private String metadadosJson;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Publicacao getPublicacao() { return publicacao; }
    public void setPublicacao(Publicacao publicacao) { this.publicacao = publicacao; }
    public PublicacaoStatusTratamento getStatusAnterior() { return statusAnterior; }
    public void setStatusAnterior(PublicacaoStatusTratamento statusAnterior) { this.statusAnterior = statusAnterior; }
    public PublicacaoStatusTratamento getStatusNovo() { return statusNovo; }
    public void setStatusNovo(PublicacaoStatusTratamento statusNovo) { this.statusNovo = statusNovo; }
    public PublicacaoAcaoTratamento getAcao() { return acao; }
    public void setAcao(PublicacaoAcaoTratamento acao) { this.acao = acao; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public Processo getProcesso() { return processo; }
    public void setProcesso(Processo processo) { this.processo = processo; }
    public Cliente getCliente() { return cliente; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public Boolean getAndamentoGerado() { return andamentoGerado; }
    public void setAndamentoGerado(Boolean andamentoGerado) { this.andamentoGerado = andamentoGerado; }
    public Boolean getPrazoGerado() { return prazoGerado; }
    public void setPrazoGerado(Boolean prazoGerado) { this.prazoGerado = prazoGerado; }
    public Boolean getTarefaGerada() { return tarefaGerada; }
    public void setTarefaGerada(Boolean tarefaGerada) { this.tarefaGerada = tarefaGerada; }
    public String getMetadadosJson() { return metadadosJson; }
    public void setMetadadosJson(String metadadosJson) { this.metadadosJson = metadadosJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
