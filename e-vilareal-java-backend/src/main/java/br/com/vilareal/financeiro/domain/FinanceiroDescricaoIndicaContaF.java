package br.com.vilareal.financeiro.domain;

import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Descrições de rendimentos, correção monetária e aplicações (CRI, LCA, CDB etc.)
 * devem ser classificadas na conta F (rendimentos).
 */
public final class FinanceiroDescricaoIndicaContaF {

    private static final Pattern TOKEN_CRI = Pattern.compile("\\bCRI\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern TOKEN_LCA = Pattern.compile("\\bLCA\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern TOKEN_CDB = Pattern.compile("\\bCDB\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private FinanceiroDescricaoIndicaContaF() {}

    public static boolean indica(String descricao, String descricaoDetalhada) {
        String texto = textoCombinado(descricao, descricaoDetalhada);
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        String t = texto.toUpperCase(Locale.ROOT);
        if (t.contains("COR JURS") || t.contains("CORJURS")) {
            return true;
        }
        if (t.contains("JUROS")) {
            return true;
        }
        return TOKEN_CRI.matcher(texto).find()
                || TOKEN_LCA.matcher(texto).find()
                || TOKEN_CDB.matcher(texto).find();
    }

    public static String textoCombinado(String descricao, String descricaoDetalhada) {
        String d1 = descricao != null ? descricao : "";
        String d2 = descricaoDetalhada != null ? descricaoDetalhada : "";
        return (d1 + " " + d2).trim();
    }
}
