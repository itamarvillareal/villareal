package br.com.vilareal.api.dto;

import jakarta.validation.constraints.Size;

public class PessoaDadosComplementaresRequest {
    @Size(max = 30)
    private String rg;
    @Size(max = 40)
    private String orgaoExpedidor;
    @Size(max = 120)
    private String profissao;
    @Size(max = 120)
    private String nacionalidade;
    @Size(max = 40)
    private String estadoCivil;
    @Size(max = 20)
    private String genero;

    public String getRg() { return rg; }
    public void setRg(String rg) { this.rg = rg; }
    public String getOrgaoExpedidor() { return orgaoExpedidor; }
    public void setOrgaoExpedidor(String orgaoExpedidor) { this.orgaoExpedidor = orgaoExpedidor; }
    public String getProfissao() { return profissao; }
    public void setProfissao(String profissao) { this.profissao = profissao; }
    public String getNacionalidade() { return nacionalidade; }
    public void setNacionalidade(String nacionalidade) { this.nacionalidade = nacionalidade; }
    public String getEstadoCivil() { return estadoCivil; }
    public void setEstadoCivil(String estadoCivil) { this.estadoCivil = estadoCivil; }
    public String getGenero() { return genero; }
    public void setGenero(String genero) { this.genero = genero; }
}
