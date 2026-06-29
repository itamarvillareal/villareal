package br.com.vilareal.common.util;

import org.springframework.util.StringUtils;

/** Validação de CNPJ (14 dígitos + DV). */
public final class CnpjUtil {

    private static final int[] PESOS_DV1 = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
    private static final int[] PESOS_DV2 = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};

    private CnpjUtil() {}

    public static String normalizar(String cnpj) {
        if (!StringUtils.hasText(cnpj)) {
            return null;
        }
        String digits = cnpj.replaceAll("\\D", "");
        return digits.length() == 14 ? digits : null;
    }

    public static boolean validarCnpj(String cnpj) {
        String digits = normalizar(cnpj);
        if (digits == null) {
            return false;
        }
        if (digits.chars().distinct().count() == 1) {
            return false;
        }
        int d1 = calcularDigito(digits, PESOS_DV1);
        int d2 = calcularDigito(digits, PESOS_DV2);
        return digits.charAt(12) == (char) ('0' + d1) && digits.charAt(13) == (char) ('0' + d2);
    }

    private static int calcularDigito(String cnpj, int[] pesos) {
        int soma = 0;
        for (int i = 0; i < pesos.length; i++) {
            soma += Character.getNumericValue(cnpj.charAt(i)) * pesos[i];
        }
        int resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }
}
