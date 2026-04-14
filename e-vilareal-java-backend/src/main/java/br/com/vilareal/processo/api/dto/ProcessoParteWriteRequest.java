package br.com.vilareal.processo.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.ArrayList;
import java.util.List;

public class ProcessoParteWriteRequest {

    private Long pessoaId;
    private String nomeLivre;

    @NotBlank
    private String polo;

    private String qualificacao;

    @NotNull
    private Integer ordem = 0;

    /** Substitui a lista de advogados (pessoas) desta parte; vazio remove todos. Null = não alterar advogados na atualização. */
    private List<Long> advogadoPessoaIds;

    /** UUID da importação em lote; opcional. */
    private String importacaoId;

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

    public List<Long> getAdvogadoPessoaIds() {
        return advogadoPessoaIds;
    }

    public void setAdvogadoPessoaIds(List<Long> advogadoPessoaIds) {
        this.advogadoPessoaIds = advogadoPessoaIds;
    }

    public String getImportacaoId() {
        return importacaoId;
    }

    public void setImportacaoId(String importacaoId) {
        this.importacaoId = importacaoId;
    }
}
