package br.com.vilareal.documento.parse;

import java.util.List;

public record SecaoDocumento(String titulo, TipoTitulo tipoTitulo, List<ParagrafoDocumento> paragrafos) {

    public SecaoDocumento {
        paragrafos = paragrafos != null ? List.copyOf(paragrafos) : List.of();
    }
}
