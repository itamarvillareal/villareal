package br.com.vilareal.processo.api.dto;

import java.util.ArrayList;
import java.util.List;

public class ProcessoParteResponse {

    private Long id;
    private Long pessoaId;
    private String nomeLivre;
    private String polo;
    private String qualificacao;
    private Integer ordem;
    private String nomeExibicao;

    /** Ids em {@code pessoa} dos advogados desta parte (ordem preservada). */
    private List<Long> advogadoPessoaIds = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getPessoaId() {
        return pessoaId;
    }

    public void setPessoaId(Long pessoaId) {
        this.pessoaId = pessoaId;
    }

    public String getNomeLivre() {
        return nomeLivre;
    }

    public void setNomeLivre(String nomeLivre) {
        this.nomeLivre = nomeLivre;
    }

    public String getPolo() {
        return polo;
    }

    public void setPolo(String polo) {
        this.polo = polo;
    }

    public String getQualificacao() {
        return qualificacao;
    }

    public void setQualificacao(String qualificacao) {
        this.qualificacao = qualificacao;
    }

    public Integer getOrdem() {
        return ordem;
    }

    public void setOrdem(Integer ordem) {
        this.ordem = ordem;
    }

    public String getNomeExibicao() {
        return nomeExibicao;
    }

    public void setNomeExibicao(String nomeExibicao) {
        this.nomeExibicao = nomeExibicao;
    }

    public List<Long> getAdvogadoPessoaIds() {
        return advogadoPessoaIds;
    }

    public void setAdvogadoPessoaIds(List<Long> advogadoPessoaIds) {
        this.advogadoPessoaIds = advogadoPessoaIds != null ? advogadoPessoaIds : new ArrayList<>();
    }
}
