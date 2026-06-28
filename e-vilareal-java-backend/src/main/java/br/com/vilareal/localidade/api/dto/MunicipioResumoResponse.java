package br.com.vilareal.localidade.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Município resumido (autocomplete / FK hidratada)")
public class MunicipioResumoResponse {

    private Integer id;
    private String nome;
    private String uf;

    public MunicipioResumoResponse() {}

    public MunicipioResumoResponse(Integer id, String nome, String uf) {
        this.id = id;
        this.nome = nome;
        this.uf = uf;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
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
}
