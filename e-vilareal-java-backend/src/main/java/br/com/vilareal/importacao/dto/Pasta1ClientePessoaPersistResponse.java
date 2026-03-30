package br.com.vilareal.importacao.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.ArrayList;
import java.util.List;

@Schema(description = "Resumo da gravação do mapeamento Pasta1 (col. A -> pessoa_id)")
public class Pasta1ClientePessoaPersistResponse {

    private String arquivo;
    private int totalLinhasLidas;
    private int linhasInseridas;
    private int linhasAtualizadas;
    private int linhasIgnoradas;
    private final List<Pasta1ClientePessoaPersistLinhaDetalhe> detalhes = new ArrayList<>();

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

    public int getLinhasInseridas() {
        return linhasInseridas;
    }

    public void setLinhasInseridas(int linhasInseridas) {
        this.linhasInseridas = linhasInseridas;
    }

    public int getLinhasAtualizadas() {
        return linhasAtualizadas;
    }

    public void setLinhasAtualizadas(int linhasAtualizadas) {
        this.linhasAtualizadas = linhasAtualizadas;
    }

    public int getLinhasIgnoradas() {
        return linhasIgnoradas;
    }

    public void setLinhasIgnoradas(int linhasIgnoradas) {
        this.linhasIgnoradas = linhasIgnoradas;
    }

    public List<Pasta1ClientePessoaPersistLinhaDetalhe> getDetalhes() {
        return detalhes;
    }
}
