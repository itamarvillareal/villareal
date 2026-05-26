package br.com.vilareal.documento.parse;

import java.util.List;

public record DocumentoParseado(
        String enderecoJuizo,
        String numeroProcesso,
        List<ParagrafoDocumento> preambulo,
        String nomePeca,
        List<SecaoDocumento> secoes,
        List<ParagrafoDocumento> fecho,
        String localData,
        String nomeAdvogado,
        String oab) {

    public DocumentoParseado {
        preambulo = preambulo != null ? List.copyOf(preambulo) : List.of();
        secoes = secoes != null ? List.copyOf(secoes) : List.of();
        fecho = fecho != null ? List.copyOf(fecho) : List.of();
    }
}
