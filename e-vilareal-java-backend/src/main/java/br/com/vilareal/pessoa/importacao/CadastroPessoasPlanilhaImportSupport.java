package br.com.vilareal.pessoa.importacao;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Normalização e truncagem alinhadas ao schema {@code pessoa} / complementar / endereço / contato.
 */
public final class CadastroPessoasPlanilhaImportSupport {

    private static final Pattern NON_DIGITS = Pattern.compile("\\D+");

    private CadastroPessoasPlanilhaImportSupport() {}

    public static String digitsOnly(String s) {
        if (s == null) return "";
        return NON_DIGITS.matcher(s.trim()).replaceAll("");
    }

    /**
     * CPF 11 ou CNPJ 14 dígitos; rejeita outros tamanhos.
     */
    public static Optional<String> normalizeCpfCnpj(String raw) {
        String d = digitsOnly(raw);
        if (d.length() == 11 || d.length() == 14) {
            return Optional.of(d);
        }
        return Optional.empty();
    }

    public static String normalizeCep(String raw) {
        String d = digitsOnly(raw);
        return d.length() > 8 ? d.substring(0, 8) : d;
    }

    /**
     * UF com 2 letras; se a célula vier com nome longo, tenta heurística mínima (primeiras 2 letras latinas).
     */
    public static String normalizeUf(String raw) {
        if (raw == null) return "";
        String t = raw.trim().toUpperCase(Locale.ROOT).replaceAll("\\s+", " ");
        if (t.length() == 2 && t.chars().allMatch(Character::isLetter)) {
            return t;
        }
        if (t.length() > 2) {
            StringBuilder sb = new StringBuilder(2);
            for (int i = 0; i < t.length() && sb.length() < 2; i++) {
                char c = t.charAt(i);
                if (c >= 'A' && c <= 'Z') {
                    sb.append(c);
                }
            }
            if (sb.length() == 2) {
                return sb.toString();
            }
        }
        return "";
    }

    public static String truncate(String s, int max) {
        if (s == null) return "";
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }

    /** Remove ';' final e trim; não força lower no valor persistido (só para chave de duplicata). */
    public static String normalizeEmailForStorage(String raw) {
        if (raw == null) return "";
        String t = raw.trim();
        while (t.endsWith(";")) {
            t = t.substring(0, t.length() - 1).trim();
        }
        return truncate(t, 255);
    }

    public static String emailDuplicateKey(String storedEmail) {
        if (storedEmail == null || storedEmail.isBlank()) {
            return "";
        }
        return storedEmail.toLowerCase(Locale.ROOT);
    }

    public static LocalDate excelDateToLocalDate(double numeric, boolean dateFormatted) {
        if (!dateFormatted) {
            return null;
        }
        try {
            return org.apache.poi.ss.usermodel.DateUtil.getJavaDate(numeric)
                    .toInstant()
                    .atZone(ZoneId.of("UTC"))
                    .toLocalDate();
        } catch (Exception e) {
            return null;
        }
    }

    public static String mergeTelefoneValor(String telDigitsOrFormatted, String inf) {
        String t = telDigitsOrFormatted == null ? "" : telDigitsOrFormatted.trim();
        String i = inf == null ? "" : inf.trim();
        if (i.isEmpty()) {
            return truncate(t, 500);
        }
        String merged = t.isEmpty() ? i : t + " — " + i;
        return truncate(merged, 500);
    }
}
