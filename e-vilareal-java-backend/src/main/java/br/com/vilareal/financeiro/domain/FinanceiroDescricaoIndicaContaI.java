package br.com.vilareal.financeiro.domain;

import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Parcelas de financiamento imobiliário (extrato bancário) → conta I (Imóveis).
 */
public final class FinanceiroDescricaoIndicaContaI {

    private FinanceiroDescricaoIndicaContaI() {}

    public static boolean indica(String descricao, String descricaoDetalhada) {
        String texto = FinanceiroDescricaoIndicaContaF.textoCombinado(descricao, descricaoDetalhada);
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        String t = normalizar(texto);
        return t.contains("FINANC") && t.contains("IMOBILIAR");
    }

    private static String normalizar(String texto) {
        String n = Normalizer.normalize(texto.trim().toUpperCase(Locale.ROOT), Normalizer.Form.NFD);
        return n.replaceAll("\\p{M}+", "");
    }
}
