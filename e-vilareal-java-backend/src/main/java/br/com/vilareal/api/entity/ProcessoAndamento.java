package br.com.vilareal.api.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "processo_andamentos", indexes = {
        @Index(name = "idx_proc_and_processo_movimento", columnList = "processo_id, movimento_em")
})
public class ProcessoAndamento {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_id", nullable = false, foreignKey = @ForeignKey(name = "fk_proc_and_processo"))
    private Processo processo;

    @Column(name = "movimento_em", nullable = false)
    private LocalDateTime movimentoEm;

    @Column(nullable = false, length = 500)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String detalhe;

    @Column(nullable = false, length = 40)
    private String origem = "MANUAL";

    @Column(name = "origem_automatica", nullable = false)
    private Boolean origemAutomatica = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", foreignKey = @ForeignKey(name = "fk_proc_and_usuario"))
    private Usuario usuario;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Processo getProcesso() { return processo; }
    public void setProcesso(Processo processo) { this.processo = processo; }
    public LocalDateTime getMovimentoEm() { return movimentoEm; }
    public void setMovimentoEm(LocalDateTime movimentoEm) { this.movimentoEm = movimentoEm; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getDetalhe() { return detalhe; }
    public void setDetalhe(String detalhe) { this.detalhe = detalhe; }
    public String getOrigem() { return origem; }
    public void setOrigem(String origem) { this.origem = origem; }
    public Boolean getOrigemAutomatica() { return origemAutomatica; }
    public void setOrigemAutomatica(Boolean origemAutomatica) { this.origemAutomatica = origemAutomatica; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
