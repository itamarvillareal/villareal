package br.com.vilareal.common.util;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Normalização de telefones brasileiros (armazenamento e comparação). */
public final class TelefoneBrasilUtil {

    private static final Pattern BLOCO_DIGITOS = Pattern.compile("\\d[\\d\\s().\\-/]*\\d");

    private TelefoneBrasilUtil() {}

    /**
     * Tenta extrair o primeiro telefone BR válido de texto livre (ex.: {@code "6199999 / 618888"}).
     */
    public static Optional<String> extrairPrimeiroValido(String texto) {
        if (texto == null || texto.isBlank()) {
            return Optional.empty();
        }
        Optional<String> direto = normalizarParaArmazenamento(texto);
        if (direto.isPresent()) {
            return direto;
        }
        for (String parte : texto.split("[/;,|]|\\s+ou\\s+|\\s+e\\s+", -1)) {
            Optional<String> norm = normalizarParaArmazenamento(parte.trim());
            if (norm.isPresent()) {
                return norm;
            }
        }
        Matcher matcher = BLOCO_DIGITOS.matcher(texto);
        while (matcher.find()) {
            Optional<String> norm = normalizarParaArmazenamento(matcher.group());
            if (norm.isPresent()) {
                return norm;
            }
        }
        return Optional.empty();
    }

    /**
     * Retorna somente dígitos com prefixo {@code 55}, ou vazio se inválido.
     * Aceita 10–11 dígitos locais ou 12–13 com DDI.
     */
    public static Optional<String> normalizarParaArmazenamento(String telefone) {
        if (telefone == null || telefone.isBlank()) {
            return Optional.empty();
        }
        String digits = telefone.replaceAll("\\D", "");
        if (digits.isEmpty()) {
            return Optional.empty();
        }
        if (digits.startsWith("0")) {
            digits = "55" + digits.substring(1);
        }
        if (!digits.startsWith("55")) {
            digits = "55" + digits;
        }
        int len = digits.length();
        if (len != 12 && len != 13) {
            return Optional.empty();
        }
        return Optional.of(digits);
    }

    /** Dígitos brutos para comparação (sem exigir DDI). */
    public static String somenteDigitos(String telefone) {
        if (telefone == null) {
            return "";
        }
        return telefone.replaceAll("\\D", "");
    }

    public static boolean numerosEquivalentes(String a, String b) {
        String da = somenteDigitos(a);
        String db = somenteDigitos(b);
        if (da.isEmpty() || db.isEmpty()) {
            return false;
        }
        if (da.equals(db)) {
            return true;
        }
        if (da.length() >= 10 && db.length() >= 10) {
            return da.endsWith(db.substring(Math.max(0, db.length() - 11)))
                    || db.endsWith(da.substring(Math.max(0, da.length() - 11)));
        }
        return false;
    }
}
