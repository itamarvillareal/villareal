package br.com.vilareal.orgaojulgador.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Órgão julgador (detalhe / autocomplete)")
public class OrgaoJulgadorResponse extends OrgaoJulgadorResumoResponse {

    private Integer tribunalId;
    private String tribunalSigla;
    private Boolean favorito;
    private Integer usoCount;
    private Boolean ativo;

    public OrgaoJulgadorResponse() {}

    public Integer getTribunalId() {
        return tribunalId;
    }

    public void setTribunalId(Integer tribunalId) {
        this.tribunalId = tribunalId;
    }

    public String getTribunalSigla() {
        return tribunalSigla;
    }

    public void setTribunalSigla(String tribunalSigla) {
        this.tribunalSigla = tribunalSigla;
    }

    public Boolean getFavorito() {
        return favorito;
    }

    public void setFavorito(Boolean favorito) {
        this.favorito = favorito;
    }

    public Integer getUsoCount() {
        return usoCount;
    }

    public void setUsoCount(Integer usoCount) {
        this.usoCount = usoCount;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }
}
