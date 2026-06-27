package br.com.vilareal.documento;

import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Interpreta valores monetários em pt-BR ou decimal ISO ({@code 1650.00}). */
public final class MoedaBrParser {

    private MoedaBrParser() {}

    public static BigDecimal parseValorMonetario(String raw) {
        if (!StringUtils.hasText(raw)) {
            return BigDecimal.ZERO;
        }
        String t = raw.trim().replaceAll("(?i)R\\$\\s?", "").replace(" ", "").replace('\u00a0', ' ');
        if (!StringUtils.hasText(t)) {
            return BigDecimal.ZERO;
        }

        int lastComma = t.lastIndexOf(',');
        int lastDot = t.lastIndexOf('.');

        if (lastComma >= 0 && lastComma > lastDot) {
            String intPart = t.substring(0, lastComma).replace(".", "");
            String frac = t.substring(lastComma + 1).replaceAll("\\D", "");
            if (!StringUtils.hasText(intPart) && !StringUtils.hasText(frac)) {
                return BigDecimal.ZERO;
            }
            String normalized = StringUtils.hasText(frac) ? intPart + "." + frac : intPart;
            return new BigDecimal(normalized);
        }

        if (lastDot >= 0 && lastDot > lastComma) {
            String frac = t.substring(lastDot + 1);
            if (frac.length() <= 2 && frac.matches("\\d*")) {
                return new BigDecimal(t);
            }
            return new BigDecimal(t.replace(".", ""));
        }

        if (t.contains(".")) {
            return new BigDecimal(t.replace(".", ""));
        }

        return new BigDecimal(t);
    }

    /** {@code 1650} → {@code "1650,00"} (sem símbolo R$). */
    public static String formatDecimalBr(BigDecimal valor) {
        if (valor == null) {
            return "";
        }
        return valor.setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }
}
