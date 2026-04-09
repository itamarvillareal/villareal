package br.com.vilareal.importacao;

import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Parsing alinhado ao plano: datas em {@code dd/MM/aaaa}, AE em Real (vírgula decimal), Sim/Não PT, AG texto.
 */
final class ImoveisPlanilhaImportSupport {

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    /** Formato de saída para campos de texto / JSON (sem fuso — {@link LocalDate}). */
    static final DateTimeFormatter DATA_TEXTO_BR = DateTimeFormatter.ofPattern("dd/MM/uuuu");
    private static final Pattern DATA_BR = Pattern.compile("^\\s*(\\d{1,2})/(\\d{1,2})/(\\d{2,4})\\s*$");

    private ImoveisPlanilhaImportSupport() {}

    static String normalizarDataTextoBr(String raw) {
        LocalDate d = parseDataFlex(raw);
        return d == null ? "" : d.format(DATA_TEXTO_BR);
    }

    static LocalDate parseDataFlex(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String t = raw.trim();
        var m = DATA_BR.matcher(t);
        if (m.matches()) {
            int dia = Integer.parseInt(m.group(1));
            int mes = Integer.parseInt(m.group(2));
            int ano = Integer.parseInt(m.group(3));
            if (ano < 100) {
                ano += ano >= 70 ? 1900 : 2000;
            }
            try {
                return LocalDate.of(ano, mes, dia);
            } catch (Exception e) {
                return null;
            }
        }
        try {
            var fmt = new DateTimeFormatterBuilder()
                    .appendPattern("[dd/MM/uuuu][d/M/uuuu][dd/MM/uu][d/M/uu]")
                    .parseDefaulting(ChronoField.NANO_OF_DAY, 0)
                    .toFormatter(PT_BR);
            return LocalDate.parse(t, fmt);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    static Integer parseInteiro(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String d = raw.trim().replaceAll("[^0-9-]", "");
        if (d.isEmpty() || "-".equals(d)) {
            return null;
        }
        try {
            return Integer.parseInt(d);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    static Long parseLongId(String raw) {
        Integer n = parseInteiro(raw);
        return n == null ? null : n.longValue();
    }

    /**
     * Real BR: milhar com ponto, decimal com vírgula; aceita célula numérica já formatada pelo Excel.
     */
    static BigDecimal parseValorRealBr(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String t = raw.trim().replace("R$", "").replace("\u00a0", " ").trim();
        if (t.isEmpty()) {
            return null;
        }
        try {
            DecimalFormatSymbols sym = DecimalFormatSymbols.getInstance(PT_BR);
            DecimalFormat df = new DecimalFormat("#,##0.###", sym);
            df.setParseBigDecimal(true);
            Number n = df.parse(t);
            if (n instanceof BigDecimal bd) {
                return bd.setScale(2, RoundingMode.HALF_UP);
            }
            return BigDecimal.valueOf(n.doubleValue()).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception e) {
            String norm = t.replace(".", "").replace(',', '.');
            try {
                return new BigDecimal(norm).setScale(2, RoundingMode.HALF_UP);
            } catch (Exception e2) {
                return null;
            }
        }
    }

    static String normalizarSimNao(String raw) {
        if (!StringUtils.hasText(raw)) {
            return "";
        }
        String t = raw.trim();
        if (t.equalsIgnoreCase("sim")) {
            return "sim";
        }
        if (t.equalsIgnoreCase("não") || t.equalsIgnoreCase("nao")) {
            return "nao";
        }
        return "";
    }

    static String trimToEmpty(String s) {
        return s == null ? "" : s.trim();
    }
}
