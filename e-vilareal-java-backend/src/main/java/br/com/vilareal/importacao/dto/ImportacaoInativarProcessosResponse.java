package br.com.vilareal.importacao.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.ArrayList;
import java.util.List;

@Schema(description = "Resumo da importação inativos.xls (col. A código cliente, col. B n.º interno)")
public class ImportacaoInativarProcessosResponse {

    private String arquivo;
    private int totalLinhasCorpo;
    private int inativados;
    private int naoEncontrados;
    private int linhasComErro;
    private final List<ImportacaoInativarProcessosLinhaDetalhe> detalhes = new ArrayList<>();

    public String getArquivo() {
        return arquivo;
    }

    public void setArquivo(String arquivo) {
        this.arquivo = arquivo;
    }

    public int getTotalLinhasCorpo() {
        return totalLinhasCorpo;
    }

    public void setTotalLinhasCorpo(int totalLinhasCorpo) {
        this.totalLinhasCorpo = totalLinhasCorpo;
    }

    public int getInativados() {
        return inativados;
    }

    public void setInativados(int inativados) {
        this.inativados = inativados;
    }

    public int getNaoEncontrados() {
        return naoEncontrados;
    }

    public void setNaoEncontrados(int naoEncontrados) {
        this.naoEncontrados = naoEncontrados;
    }

    public int getLinhasComErro() {
        return linhasComErro;
    }

    public void setLinhasComErro(int linhasComErro) {
        this.linhasComErro = linhasComErro;
    }

    public List<ImportacaoInativarProcessosLinhaDetalhe> getDetalhes() {
        return detalhes;
    }
}
