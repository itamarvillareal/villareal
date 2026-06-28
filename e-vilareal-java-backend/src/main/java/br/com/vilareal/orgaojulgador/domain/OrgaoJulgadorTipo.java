package br.com.vilareal.orgaojulgador.domain;

import java.util.Locale;

public enum OrgaoJulgadorTipo {
    VARA,
    JUIZADO,
    CAMARA,
    TURMA,
    SECAO,
    OUTRO;

    public static OrgaoJulgadorTipo fromCodigo(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            return OUTRO;
        }
        try {
            return valueOf(codigo.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return OUTRO;
        }
    }
}
