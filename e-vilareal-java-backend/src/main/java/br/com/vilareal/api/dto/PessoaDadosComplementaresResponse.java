package br.com.vilareal.api.dto;

public class PessoaDadosComplementaresResponse {
    private Long pessoaId;
    private String rg;
    private String orgaoExpedidor;
    private String profissao;
    private String nacionalidade;
    private String estadoCivil;
    private String genero;

    public Long getPessoaId() { return pessoaId; }
    public void setPessoaId(Long pessoaId) { this.pessoaId = pessoaId; }
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
