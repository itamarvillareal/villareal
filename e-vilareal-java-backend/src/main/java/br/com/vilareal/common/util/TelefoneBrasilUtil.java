package br.com.vilareal.common.util;

import java.util.Optional;

/** Normalização de telefones brasileiros (armazenamento e comparação). */
public final class TelefoneBrasilUtil {

    private TelefoneBrasilUtil() {}

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
