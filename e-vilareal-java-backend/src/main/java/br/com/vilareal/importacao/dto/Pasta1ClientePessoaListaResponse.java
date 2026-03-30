package br.com.vilareal.importacao.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.ArrayList;
import java.util.List;

@Schema(description = "Extração da planilha Pasta1: coluna A = cliente, coluna B = id pessoa")
public class Pasta1ClientePessoaListaResponse {

    private String arquivo;
    private int totalLinhasLidas;
    private final List<Pasta1ClientePessoaItemResponse> itens = new ArrayList<>();

    public String getArquivo() {
        return arquivo;
    }

    public void setArquivo(String arquivo) {
        this.arquivo = arquivo;
    }

    public int getTotalLinhasLidas() {
        return totalLinhasLidas;
    }

    public void setTotalLinhasLidas(int totalLinhasLidas) {
        this.totalLinhasLidas = totalLinhasLidas;
    }

    public List<Pasta1ClientePessoaItemResponse> getItens() {
        return itens;
    }
}
