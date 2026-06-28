package br.com.vilareal.localidade.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "UF (estado brasileiro)")
public class EstadoResponse {

    private Integer id;
    private String sigla;
    private String nome;

    public EstadoResponse() {}

    public EstadoResponse(Integer id, String sigla, String nome) {
        this.id = id;
        this.sigla = sigla;
        this.nome = nome;
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
}
