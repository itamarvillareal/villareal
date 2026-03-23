package br.com.vilareal.api.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "processo_partes", indexes = {
        @Index(name = "idx_proc_partes_processo", columnList = "processo_id"),
        @Index(name = "idx_proc_partes_pessoa", columnList = "pessoa_id")
})
public class ProcessoParte {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "processo_id", nullable = false, foreignKey = @ForeignKey(name = "fk_proc_partes_processo"))
    private Processo processo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pessoa_id", foreignKey = @ForeignKey(name = "fk_proc_partes_pessoa"))
    private CadastroPessoa pessoa;

    @Column(name = "nome_livre", length = 255)
    private String nomeLivre;

    @Column(nullable = false, length = 40)
    private String polo;

    @Column(length = 120)
    private String qualificacao;

    @Column(nullable = false)
    private Integer ordem = 0;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Processo getProcesso() { return processo; }
    public void setProcesso(Processo processo) { this.processo = processo; }
    public CadastroPessoa getPessoa() { return pessoa; }
    public void setPessoa(CadastroPessoa pessoa) { this.pessoa = pessoa; }
    public String getNomeLivre() { return nomeLivre; }
    public void setNomeLivre(String nomeLivre) { this.nomeLivre = nomeLivre; }
    public String getPolo() { return polo; }
    public void setPolo(String polo) { this.polo = polo; }
    public String getQualificacao() { return qualificacao; }
    public void setQualificacao(String qualificacao) { this.qualificacao = qualificacao; }
    public Integer getOrdem() { return ordem; }
    public void setOrdem(Integer ordem) { this.ordem = ordem; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
