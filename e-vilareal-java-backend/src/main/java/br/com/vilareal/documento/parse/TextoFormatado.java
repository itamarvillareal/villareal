package br.com.vilareal.documento.parse;

public record TextoFormatado(
        String texto, boolean negrito, boolean italico, boolean caps, boolean sublinhado, boolean destacado) {

    public TextoFormatado(String texto, boolean negrito, boolean italico, boolean caps) {
        this(texto, negrito, italico, caps, false, false);
    }

    public TextoFormatado {
        texto = texto != null ? texto : "";
    }
}
