package br.com.vilareal.pessoa.api.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.annotation.Nulls;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Dados complementares (paridade pessoasComplementaresRepository)")
public class PessoaComplementarPayload {

    private String rg;
    private String orgaoExpedidor;
    private String profissao;
    private String nacionalidade;
    private String estadoCivil;
    private String genero;

    @Schema(description = "Mesmo dado lógico que processo.descricaoAcao; label distinto no UI (Clientes vs Processos).")
    private String descricaoAcao;

    public String getRg() {
        return rg;
    }

    @JsonSetter(nulls = Nulls.SKIP)
    public void setRg(String rg) {
        this.rg = blankToNull(rg);
    }

    public String getOrgaoExpedidor() {
        return orgaoExpedidor;
    }

    @JsonSetter(nulls = Nulls.SKIP)
    public void setOrgaoExpedidor(String orgaoExpedidor) {
        this.orgaoExpedidor = blankToNull(orgaoExpedidor);
    }

    public String getProfissao() {
        return profissao;
    }

    @JsonSetter(nulls = Nulls.SKIP)
    public void setProfissao(String profissao) {
        this.profissao = blankToNull(profissao);
    }

    public String getNacionalidade() {
        return nacionalidade;
    }

    @JsonSetter(nulls = Nulls.SKIP)
    public void setNacionalidade(String nacionalidade) {
        this.nacionalidade = blankToNull(nacionalidade);
    }

    public String getEstadoCivil() {
        return estadoCivil;
    }

    @JsonSetter(nulls = Nulls.SKIP)
    public void setEstadoCivil(String estadoCivil) {
        this.estadoCivil = blankToNull(estadoCivil);
    }

    public String getGenero() {
        return genero;
    }

    @JsonSetter(nulls = Nulls.SKIP)
    public void setGenero(String genero) {
        this.genero = blankToNull(genero);
    }

    public String getDescricaoAcao() {
        return descricaoAcao;
    }

    @JsonSetter(nulls = Nulls.SKIP)
    public void setDescricaoAcao(String descricaoAcao) {
        this.descricaoAcao = blankToNull(descricaoAcao);
    }

    private static String blankToNull(String s) {
        if (s == null || s.isBlank()) return null;
        return s.trim();
    }
}
