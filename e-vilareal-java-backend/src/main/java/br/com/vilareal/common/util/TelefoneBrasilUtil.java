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
     * Formato canônico BR (WhatsApp/armazenamento): {@code 55} + DDD (2) + local (8 fixo ou 9 celular).
     * <p>
     * Regra do nono dígito: se a parte local tem 8 dígitos e o primeiro é {@code 6–9} (celular),
     * insere {@code 9} antes da local → 13 dígitos totais. Fixo ({@code 2–5}) permanece com 12.
     * <p>
     * Exemplos:
     * <ul>
     *   <li>{@code 556292975894} → {@code 5562992975894} (celular GO sem 9)</li>
     *   <li>{@code 5562992975894} → inalterado (celular já com 9)</li>
     *   <li>{@code 556232179999} → inalterado (fixo GO)</li>
     * </ul>
     *
     * @throws IllegalArgumentException se o número for nulo, vazio ou com comprimento inválido
     */
    public static String canonicalizar(String telefone) {
        if (telefone == null || telefone.isBlank()) {
            throw new IllegalArgumentException("Número de telefone inválido: " + telefone);
        }
        String digits = somenteDigitos(telefone);
        if (digits.isEmpty()) {
            throw new IllegalArgumentException("Número de telefone inválido: " + telefone);
        }
        if (digits.startsWith("0")) {
            digits = "55" + digits.substring(1);
        }
        if (!digits.startsWith("55")) {
            digits = "55" + digits;
        }
        return aplicarNonoDigitoCelular(digits, telefone);
    }

    /**
     * Retorna somente dígitos com prefixo {@code 55} no formato canônico, ou vazio se inválido.
     * Usa a mesma regra de {@link #canonicalizar(String)}.
     */
    public static Optional<String> normalizarParaArmazenamento(String telefone) {
        try {
            return Optional.of(canonicalizar(telefone));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /**
     * Após {@code 55} + DDD, insere o nono dígito em celular (local 8 dígitos, primeiro 6–9).
     * {@code digits} deve conter apenas dígitos, começar com {@code 55} e ter 12 ou 13 caracteres.
     */
    static String aplicarNonoDigitoCelular(String digits, String telefoneOriginal) {
        int length = digits.length();
        if (length != 12 && length != 13) {
            throw new IllegalArgumentException("Número de telefone inválido: " + telefoneOriginal);
        }

        String ddd = digits.substring(2, 4);
        String local = digits.substring(4);

        if (local.length() == 8 && isPrimeiroDigitoLocalCelular(local.charAt(0))) {
            local = "9" + local;
            digits = "55" + ddd + local;
        } else if (local.length() != 8 && local.length() != 9) {
            throw new IllegalArgumentException("Número de telefone inválido: " + telefoneOriginal);
        }

        int finalLength = digits.length();
        if (finalLength != 12 && finalLength != 13) {
            throw new IllegalArgumentException("Número de telefone inválido: " + telefoneOriginal);
        }
        return digits;
    }

    /** Celular BR: após o DDD, o primeiro dígito da parte local é 6, 7, 8 ou 9. */
    private static boolean isPrimeiroDigitoLocalCelular(char firstLocalDigit) {
        return firstLocalDigit >= '6' && firstLocalDigit <= '9';
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
