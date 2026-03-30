package br.com.vilareal.importacao.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.ArrayList;
import java.util.List;

@Schema(description = "Resumo da importação Informacoes de processos.xls")
public class ImportacaoInformacoesProcessosResponse {

    private String arquivo;
    private int totalLinhasCorpo;
    private int linhasIgnoradas;
    private int linhasProcessadasComSucesso;
    private int linhasComErro;
    private final List<ImportacaoLinhaDetalhe> detalhes = new ArrayList<>();

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

    public int getLinhasIgnoradas() {
        return linhasIgnoradas;
    }

    public void setLinhasIgnoradas(int linhasIgnoradas) {
        this.linhasIgnoradas = linhasIgnoradas;
    }

    public int getLinhasProcessadasComSucesso() {
        return linhasProcessadasComSucesso;
    }

    public void setLinhasProcessadasComSucesso(int linhasProcessadasComSucesso) {
        this.linhasProcessadasComSucesso = linhasProcessadasComSucesso;
    }

    public int getLinhasComErro() {
        return linhasComErro;
    }

    public void setLinhasComErro(int linhasComErro) {
        this.linhasComErro = linhasComErro;
    }

    public List<ImportacaoLinhaDetalhe> getDetalhes() {
        return detalhes;
    }
}
