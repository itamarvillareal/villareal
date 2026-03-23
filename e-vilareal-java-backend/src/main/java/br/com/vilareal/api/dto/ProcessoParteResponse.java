package br.com.vilareal.api.dto;

import java.time.LocalDateTime;

public class ProcessoParteResponse {
    private Long id;
    private Long processoId;
    private Long pessoaId;
    private String nomeLivre;
    private String nomeExibicao;
    private String polo;
    private String qualificacao;
    private Integer ordem;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getProcessoId() { return processoId; }
    public void setProcessoId(Long processoId) { this.processoId = processoId; }
    public Long getPessoaId() { return pessoaId; }
    public void setPessoaId(Long pessoaId) { this.pessoaId = pessoaId; }
    public String getNomeLivre() { return nomeLivre; }
    public void setNomeLivre(String nomeLivre) { this.nomeLivre = nomeLivre; }
    public String getNomeExibicao() { return nomeExibicao; }
    public void setNomeExibicao(String nomeExibicao) { this.nomeExibicao = nomeExibicao; }
    public String getPolo() { return polo; }
    public void setPolo(String polo) { this.polo = polo; }
    public String getQualificacao() { return qualificacao; }
    public void setQualificacao(String qualificacao) { this.qualificacao = qualificacao; }
    public Integer getOrdem() { return ordem; }
    public void setOrdem(Integer ordem) { this.ordem = ordem; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
