package br.com.vilareal.topicos.api.dto;

import java.util.ArrayList;
import java.util.List;

public class TopicoImportResultDto {

    private int totalArquivos;
    private int totalBlocos;
    private int totalImportados;
    private int totalAtualizados;
    private List<String> categorias = new ArrayList<>();
    private List<String> erros = new ArrayList<>();

    public int getTotalArquivos() {
        return totalArquivos;
    }

    public void setTotalArquivos(int totalArquivos) {
        this.totalArquivos = totalArquivos;
    }

    public int getTotalBlocos() {
        return totalBlocos;
    }

    public void setTotalBlocos(int totalBlocos) {
        this.totalBlocos = totalBlocos;
    }

    public int getTotalImportados() {
        return totalImportados;
    }

    public void setTotalImportados(int totalImportados) {
        this.totalImportados = totalImportados;
    }

    public int getTotalAtualizados() {
        return totalAtualizados;
    }

    public void setTotalAtualizados(int totalAtualizados) {
        this.totalAtualizados = totalAtualizados;
    }

    public List<String> getCategorias() {
        return categorias;
    }

    public void setCategorias(List<String> categorias) {
        this.categorias = categorias;
    }

    public List<String> getErros() {
        return erros;
    }

    public void setErros(List<String> erros) {
        this.erros = erros;
    }
}
