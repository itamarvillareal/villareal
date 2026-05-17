package br.com.vilareal.financeiro.domain;

public enum ConfiancaSugestao {
    ALTA,
    MEDIA,
    BAIXA;

    public boolean atendeMinimo(ConfiancaSugestao minimo) {
        if (minimo == null) {
            return true;
        }
        return ordinal() <= minimo.ordinal();
    }
}
