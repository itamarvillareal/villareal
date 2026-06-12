package br.com.vilareal.financeiro.domain;

import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Transferências internas entre contas do escritório (Itamar / VRV) devem ir para a conta E
 * (compensação), não para A (cliente/processo).
 */
public final class FinanceiroDescricaoIndicaContaE {

    private static final Pattern TOKEN_VRV =
            Pattern.compile("\\bVRV\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private FinanceiroDescricaoIndicaContaE() {}

    public static boolean indica(String descricao, String descricaoDetalhada) {
        String texto = FinanceiroDescricaoIndicaContaF.textoCombinado(descricao, descricaoDetalhada);
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        if (TOKEN_VRV.matcher(texto).find()) {
            return true;
        }
        String t = texto.toUpperCase(Locale.ROOT);
        if (!t.contains("ITAMAR")) {
            return false;
        }
        return indicaTransferenciaInterna(t);
    }

    private static boolean indicaTransferenciaInterna(String t) {
        if (t.contains("TRANSF") || t.contains("TRANSFERENCIA") || t.contains("TRANSFERÊNCIA")) {
            return true;
        }
        return t.contains("PIX");
    }
}
