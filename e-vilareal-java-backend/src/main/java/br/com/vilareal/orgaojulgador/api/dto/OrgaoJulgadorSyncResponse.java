package br.com.vilareal.orgaojulgador.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Resultado da sincronização DataJud de órgãos julgadores")
public class OrgaoJulgadorSyncResponse {

    private Integer tribunalId;
    private String tribunalSigla;
    private int orgaosRecebidos;
    private int orgaosInseridos;
    private int orgaosAtualizados;
    private int orgaosDesativados;
    private int orgaosSemMunicipio;
    private boolean desativacaoExecutada;
    private boolean fallbackJson;
    private String mensagem;

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

    public int getOrgaosRecebidos() {
        return orgaosRecebidos;
    }

    public void setOrgaosRecebidos(int orgaosRecebidos) {
        this.orgaosRecebidos = orgaosRecebidos;
    }

    public int getOrgaosInseridos() {
        return orgaosInseridos;
    }

    public void setOrgaosInseridos(int orgaosInseridos) {
        this.orgaosInseridos = orgaosInseridos;
    }

    public int getOrgaosAtualizados() {
        return orgaosAtualizados;
    }

    public void setOrgaosAtualizados(int orgaosAtualizados) {
        this.orgaosAtualizados = orgaosAtualizados;
    }

    public int getOrgaosDesativados() {
        return orgaosDesativados;
    }

    public void setOrgaosDesativados(int orgaosDesativados) {
        this.orgaosDesativados = orgaosDesativados;
    }

    public int getOrgaosSemMunicipio() {
        return orgaosSemMunicipio;
    }

    public void setOrgaosSemMunicipio(int orgaosSemMunicipio) {
        this.orgaosSemMunicipio = orgaosSemMunicipio;
    }

    public boolean isDesativacaoExecutada() {
        return desativacaoExecutada;
    }

    public void setDesativacaoExecutada(boolean desativacaoExecutada) {
        this.desativacaoExecutada = desativacaoExecutada;
    }

    public boolean isFallbackJson() {
        return fallbackJson;
    }

    public void setFallbackJson(boolean fallbackJson) {
        this.fallbackJson = fallbackJson;
    }

    public String getMensagem() {
        return mensagem;
    }

    public void setMensagem(String mensagem) {
        this.mensagem = mensagem;
    }
}
