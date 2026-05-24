package br.com.vilareal.common.util;

import org.springframework.util.StringUtils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Extração e validação de CPF (11 dígitos) em texto livre. */
public final class CpfUtil {

    private static final Pattern CPF_FORMATADO =
            Pattern.compile("(?<!\\d)(\\d{3})\\.?(\\d{3})\\.?(\\d{3})-?(\\d{2})(?!\\d)");
    private static final Pattern CPF_ONZE_DIGITOS = Pattern.compile("(?<!\\d)(\\d{11})(?!\\d)");

    private CpfUtil() {}

    public static String normalizar(String cpf) {
        if (!StringUtils.hasText(cpf)) {
            return null;
        }
        String digits = cpf.replaceAll("\\D", "");
        return digits.length() == 11 ? digits : null;
    }

    /** Extrai o primeiro CPF válido encontrado no texto. */
    public static String extrairCpfValido(String texto) {
        if (!StringUtils.hasText(texto)) {
            return null;
        }
        Matcher formatado = CPF_FORMATADO.matcher(texto);
        while (formatado.find()) {
            String digits = formatado.group(1) + formatado.group(2) + formatado.group(3) + formatado.group(4);
            if (validarCpf(digits)) {
                return digits;
            }
        }
        Matcher onze = CPF_ONZE_DIGITOS.matcher(texto);
        while (onze.find()) {
            String digits = onze.group(1);
            if (validarCpf(digits)) {
                return digits;
            }
        }
        return null;
    }

    public static boolean validarCpf(String cpf) {
        String digits = normalizar(cpf);
        if (digits == null) {
            return false;
        }
        if (digits.chars().distinct().count() == 1) {
            return false;
        }
        int d1 = calcularDigito(digits, 9);
        int d2 = calcularDigito(digits, 10);
        return digits.charAt(9) == (char) ('0' + d1) && digits.charAt(10) == (char) ('0' + d2);
    }

    private static int calcularDigito(String cpf, int posicao) {
        int soma = 0;
        for (int i = 0; i < posicao; i++) {
            soma += Character.getNumericValue(cpf.charAt(i)) * (posicao + 1 - i);
        }
        int resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }
}
