package br.com.vilareal.documento.parse;

public record TextoFormatado(String texto, boolean negrito, boolean italico, boolean caps) {

    public TextoFormatado {
        texto = texto != null ? texto : "";
    }
}
