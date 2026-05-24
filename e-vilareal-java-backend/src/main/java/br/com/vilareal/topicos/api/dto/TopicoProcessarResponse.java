package br.com.vilareal.topicos.api.dto;

import java.util.ArrayList;
import java.util.List;

public class TopicoProcessarResponse {

    private Long topicoId;
    private String nome;
    private String tipoFormatacao;
    private String textoProcessado;
    private List<String> placeholdersNaoResolvidos = new ArrayList<>();

    public Long getTopicoId() {
        return topicoId;
    }

    public void setTopicoId(Long topicoId) {
        this.topicoId = topicoId;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getTipoFormatacao() {
        return tipoFormatacao;
    }

    public void setTipoFormatacao(String tipoFormatacao) {
        this.tipoFormatacao = tipoFormatacao;
    }

    public String getTextoProcessado() {
        return textoProcessado;
    }

    public void setTextoProcessado(String textoProcessado) {
        this.textoProcessado = textoProcessado;
    }

    public List<String> getPlaceholdersNaoResolvidos() {
        return placeholdersNaoResolvidos;
    }

    public void setPlaceholdersNaoResolvidos(List<String> placeholdersNaoResolvidos) {
        this.placeholdersNaoResolvidos = placeholdersNaoResolvidos;
    }
}
