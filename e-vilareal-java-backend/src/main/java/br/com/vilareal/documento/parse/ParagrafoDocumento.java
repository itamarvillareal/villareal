package br.com.vilareal.documento.parse;

import java.util.List;

public record ParagrafoDocumento(TipoParagrafo tipo, List<TextoFormatado> conteudo, String estiloCss) {

    public ParagrafoDocumento {
        conteudo = conteudo != null ? List.copyOf(conteudo) : List.of();
        if (estiloCss != null && estiloCss.isBlank()) {
            estiloCss = null;
        }
    }

    public ParagrafoDocumento(TipoParagrafo tipo, List<TextoFormatado> conteudo) {
        this(tipo, conteudo, null);
    }

    public String textoPlano() {
        return conteudo.stream().map(TextoFormatado::texto).reduce("", String::concat).trim();
    }
}
