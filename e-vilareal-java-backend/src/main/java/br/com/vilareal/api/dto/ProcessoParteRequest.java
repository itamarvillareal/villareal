package br.com.vilareal.api.dto;

import jakarta.validation.constraints.NotBlank;

public class ProcessoParteRequest {
    private Long pessoaId;
    private String nomeLivre;

    @NotBlank
    private String polo;

    private String qualificacao;

    /** Se omitido, o serviço assume 0. */
    private Integer ordem;

    public Long getPessoaId() { return pessoaId; }
    public void setPessoaId(Long pessoaId) { this.pessoaId = pessoaId; }
    public String getNomeLivre() { return nomeLivre; }
    public void setNomeLivre(String nomeLivre) { this.nomeLivre = nomeLivre; }
    public String getPolo() { return polo; }
    public void setPolo(String polo) { this.polo = polo; }
    public String getQualificacao() { return qualificacao; }
    public void setQualificacao(String qualificacao) { this.qualificacao = qualificacao; }
    public Integer getOrdem() { return ordem; }
    public void setOrdem(Integer ordem) { this.ordem = ordem; }
}
