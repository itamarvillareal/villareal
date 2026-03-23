package br.com.vilareal.api.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "contas_contabeis", indexes = {
        @Index(name = "idx_contas_contabeis_ativa", columnList = "ativa"),
        @Index(name = "idx_contas_contabeis_ordem", columnList = "ordem_exibicao")
})
public class ContaContabil {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 10)
    private String codigo;

    @Column(nullable = false, unique = true, length = 120)
    private String nome;

    @Column(nullable = false, length = 30)
    private String tipo;

    @Column(name = "natureza_padrao", length = 20)
    private String naturezaPadrao;

    @Column(name = "grupo_contabil", length = 80)
    private String grupoContabil;

    @Column(name = "aceita_vinculo_processo", nullable = false)
    private Boolean aceitaVinculoProcesso = false;

    @Column(name = "aceita_compensacao", nullable = false)
    private Boolean aceitaCompensacao = false;

    @Column(nullable = false)
    private Boolean ativa = true;

    @Column(name = "ordem_exibicao", nullable = false)
    private Integer ordemExibicao = 0;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getNaturezaPadrao() { return naturezaPadrao; }
    public void setNaturezaPadrao(String naturezaPadrao) { this.naturezaPadrao = naturezaPadrao; }
    public String getGrupoContabil() { return grupoContabil; }
    public void setGrupoContabil(String grupoContabil) { this.grupoContabil = grupoContabil; }
    public Boolean getAceitaVinculoProcesso() { return aceitaVinculoProcesso; }
    public void setAceitaVinculoProcesso(Boolean aceitaVinculoProcesso) { this.aceitaVinculoProcesso = aceitaVinculoProcesso; }
    public Boolean getAceitaCompensacao() { return aceitaCompensacao; }
    public void setAceitaCompensacao(Boolean aceitaCompensacao) { this.aceitaCompensacao = aceitaCompensacao; }
    public Boolean getAtiva() { return ativa; }
    public void setAtiva(Boolean ativa) { this.ativa = ativa; }
    public Integer getOrdemExibicao() { return ordemExibicao; }
    public void setOrdemExibicao(Integer ordemExibicao) { this.ordemExibicao = ordemExibicao; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
