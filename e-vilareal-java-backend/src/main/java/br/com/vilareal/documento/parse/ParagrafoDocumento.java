package br.com.vilareal.documento.parse;

import java.util.List;

public record ParagrafoDocumento(TipoParagrafo tipo, List<TextoFormatado> conteudo) {

    public ParagrafoDocumento {
        conteudo = conteudo != null ? List.copyOf(conteudo) : List.of();
    }

    public String textoPlano() {
        return conteudo.stream().map(TextoFormatado::texto).reduce("", String::concat).trim();
    }
}
