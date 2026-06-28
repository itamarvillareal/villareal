package br.com.vilareal.orgaojulgador.api.dto;

import br.com.vilareal.localidade.api.dto.MunicipioResumoResponse;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Órgão julgador resumido (autocomplete / FK hidratada)")
public class OrgaoJulgadorResumoResponse {

    private Long id;
    private Integer codigoCnj;
    private String nome;
    private String grau;
    private String tipo;
    private MunicipioResumoResponse municipio;

    public OrgaoJulgadorResumoResponse() {}

    public OrgaoJulgadorResumoResponse(
            Long id,
            Integer codigoCnj,
            String nome,
            String grau,
            String tipo,
            MunicipioResumoResponse municipio) {
        this.id = id;
        this.codigoCnj = codigoCnj;
        this.nome = nome;
        this.grau = grau;
        this.tipo = tipo;
        this.municipio = municipio;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getCodigoCnj() {
        return codigoCnj;
    }

    public void setCodigoCnj(Integer codigoCnj) {
        this.codigoCnj = codigoCnj;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getGrau() {
        return grau;
    }

    public void setGrau(String grau) {
        this.grau = grau;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public MunicipioResumoResponse getMunicipio() {
        return municipio;
    }

    public void setMunicipio(MunicipioResumoResponse municipio) {
        this.municipio = municipio;
    }
}
