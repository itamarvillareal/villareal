package br.com.vilareal.financeiro.domain;

import br.com.vilareal.common.exception.BusinessRuleException;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Normaliza valor digitado para pesquisa exata (módulo, 2 casas). */
public final class FinanceiroValorExatoUtil {

    private FinanceiroValorExatoUtil() {}

    /**
     * Aceita "1234,56", "-1234.56", "R$ 1.234,56" etc. Retorna valor absoluto com escala 2.
     */
    public static BigDecimal parseValorAbsolutoExato(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessRuleException("Informe o valor do lançamento.");
        }
        String s = raw.trim().replaceAll("[R$\\s]", "");
        if (!s.matches("[-+]?[\\d.,]+")) {
            throw new BusinessRuleException("Valor inválido. Use apenas números (ex.: 1500,00).");
        }
        s = s.replaceFirst("^[-+]", "");
        try {
            if (s.contains(",")) {
                int comma = s.indexOf(',');
                String intPart = s.substring(0, comma).replace(".", "");
                String decPart = s.substring(comma + 1).replaceAll("\\D", "");
                if (intPart.isEmpty()) {
                    intPart = "0";
                }
                if (decPart.isEmpty()) {
                    decPart = "00";
                } else if (decPart.length() == 1) {
                    decPart = decPart + "0";
                } else if (decPart.length() > 2) {
                    decPart = decPart.substring(0, 2);
                }
                return new BigDecimal(intPart + "." + decPart).abs().setScale(2, RoundingMode.HALF_UP);
            }
            if (s.contains(".")) {
                int dot = s.indexOf('.');
                String intPart = s.substring(0, dot).replace(".", "");
                String decPart = s.substring(dot + 1).replaceAll("\\D", "");
                if (intPart.isEmpty()) {
                    intPart = "0";
                }
                if (decPart.length() >= 2) {
                    decPart = decPart.length() > 2 ? decPart.substring(0, 2) : decPart;
                    return new BigDecimal(intPart + "." + decPart).abs().setScale(2, RoundingMode.HALF_UP);
                }
                if (decPart.isEmpty()) {
                    return new BigDecimal(intPart).abs().setScale(2, RoundingMode.HALF_UP);
                }
                return new BigDecimal(intPart + "." + decPart).abs().setScale(2, RoundingMode.HALF_UP);
            }
            String digits = s.replace(".", "");
            if (digits.isEmpty()) {
                throw new BusinessRuleException("Valor inválido.");
            }
            return new BigDecimal(digits).abs().setScale(2, RoundingMode.HALF_UP);
        } catch (NumberFormatException e) {
            throw new BusinessRuleException("Valor inválido. Use apenas números (ex.: 1500,00).");
        }
    }
}
