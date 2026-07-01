package br.com.vilareal.pessoa.application;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Normalização e variantes de telefone BR para busca no cadastro de pessoas. */
public final class TelefoneBuscaSupport {

    private TelefoneBuscaSupport() {}

    public static String normalizar(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = raw.replaceAll("\\D", "");
        return digits.length() >= 4 ? digits : null;
    }

    /**
     * Variantes do termo digitado: original, com/sem nono dígito após DDD e sem DDI 55.
     */
    public static List<String> variantes(String digits) {
        Set<String> out = new LinkedHashSet<>();
        if (digits == null || digits.isBlank()) {
            return List.of();
        }
        out.add(digits);
        if (digits.startsWith("55") && digits.length() > 11) {
            adicionarVariantesNacionais(out, digits.substring(2));
        }
        adicionarVariantesNacionais(out, digits);
        return new ArrayList<>(out);
    }

    /** Últimos 8 dígitos (parte local) para casar celular com/sem 9 — ex.: 92682445. */
    public static String sufixoLocal(String digits) {
        if (digits == null || digits.length() < 8) {
            return "";
        }
        return digits.substring(digits.length() - 8);
    }

    private static void adicionarVariantesNacionais(Set<String> out, String digits) {
        if (digits == null || digits.isBlank()) {
            return;
        }
        out.add(digits);
        // BR: DDD (2) + 8 dígitos locais (10) ↔ DDD + 9 + 8 dígitos (11)
        if (digits.length() == 10) {
            out.add(digits.substring(0, 2) + "9" + digits.substring(2));
        }
        if (digits.length() == 11 && digits.charAt(2) == '9') {
            out.add(digits.substring(0, 2) + digits.substring(3));
        }
    }
}
