package br.com.vilareal.api.dto;

import java.time.LocalDateTime;

public class ContaContabilResponse {
    private Long id;
    private String codigo;
    private String nome;
    private String tipo;
    private String naturezaPadrao;
    private String grupoContabil;
    private Boolean aceitaVinculoProcesso;
    private Boolean aceitaCompensacao;
    private Boolean ativa;
    private Integer ordemExibicao;
    private LocalDateTime createdAt;
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
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
