package br.com.vilareal.orgaojulgador.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Tribunal de Justiça estadual")
public class TribunalResponse {

    private Integer id;
    private String sigla;
    private String nome;
    private String uf;
    private String datajudAlias;
    private Boolean ativo;

    public TribunalResponse() {}

    public TribunalResponse(Integer id, String sigla, String nome, String uf, String datajudAlias, Boolean ativo) {
        this.id = id;
        this.sigla = sigla;
        this.nome = nome;
        this.uf = uf;
        this.datajudAlias = datajudAlias;
        this.ativo = ativo;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getSigla() {
        return sigla;
    }

    public void setSigla(String sigla) {
        this.sigla = sigla;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getUf() {
        return uf;
    }

    public void setUf(String uf) {
        this.uf = uf;
    }

    public String getDatajudAlias() {
        return datajudAlias;
    }

    public void setDatajudAlias(String datajudAlias) {
        this.datajudAlias = datajudAlias;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }
}
