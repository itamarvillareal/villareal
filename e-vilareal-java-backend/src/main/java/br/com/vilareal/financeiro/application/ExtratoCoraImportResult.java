package br.com.vilareal.financeiro.application;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExtratoCoraImportResult {

    private int totalNoArquivo;
    private int criados;
    private int jaExistia;
    private int falhas;
}
