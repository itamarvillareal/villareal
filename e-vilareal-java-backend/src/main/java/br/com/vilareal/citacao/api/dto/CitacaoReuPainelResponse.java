package br.com.vilareal.citacao.api.dto;

import java.util.ArrayList;
import java.util.List;

public class CitacaoReuPainelResponse {

    private Long processoParteId;
    private Long pessoaId;
    private String nomeParte;
    private List<CitacaoTentativaResponse> tentados = new ArrayList<>();
    private List<CitacaoEnderecoProximoResponse> proximos = new ArrayList<>();

    public Long getProcessoParteId() {
        return processoParteId;
    }

    public void setProcessoParteId(Long processoParteId) {
        this.processoParteId = processoParteId;
    }

    public Long getPessoaId() {
        return pessoaId;
    }

    public void setPessoaId(Long pessoaId) {
        this.pessoaId = pessoaId;
    }

    public String getNomeParte() {
        return nomeParte;
    }

    public void setNomeParte(String nomeParte) {
        this.nomeParte = nomeParte;
    }

    public List<CitacaoTentativaResponse> getTentados() {
        return tentados;
    }

    public void setTentados(List<CitacaoTentativaResponse> tentados) {
        this.tentados = tentados != null ? tentados : new ArrayList<>();
    }

    public List<CitacaoEnderecoProximoResponse> getProximos() {
        return proximos;
    }

    public void setProximos(List<CitacaoEnderecoProximoResponse> proximos) {
        this.proximos = proximos != null ? proximos : new ArrayList<>();
    }
}
