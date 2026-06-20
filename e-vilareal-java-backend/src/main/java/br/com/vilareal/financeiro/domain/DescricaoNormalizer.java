package br.com.vilareal.financeiro.domain;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Normaliza descrições de extrato para agrupamento (recorrência, histórico, painel analítico).
 * Remove datas/horas coladas no fim sem alterar dígitos no meio da string.
 */
public final class DescricaoNormalizer {

    private static final int MAX_LEN = 255;

    private static final Pattern DATE_SLASH_END = Pattern.compile("\\d{2}/\\d{2}(/\\d{2,4})?$");
    private static final Pattern DATE_DASH_END = Pattern.compile("\\d{2}-\\d{2}(-\\d{2,4})?$");
    private static final Pattern DATE_DOT_END = Pattern.compile("\\d{2}\\.\\d{2}(\\.\\d{2,4})?$");
    /** DD MM ou DD/MM no fim, com separador espaço, barra, ponto ou hífen. */
    private static final Pattern DATE_SEPARATED_END =
            Pattern.compile("\\d{1,2}[\\s/.\\-]\\d{1,2}([\\s/.\\-]\\d{2,4})?$");
    /** DDMMAAAA ou DDMMYY (6–8 dígitos) colados após letra no fim. */
    private static final Pattern DATE_GLUED_END = Pattern.compile("(?<=[A-Z])\\d{6,8}$");
    /** DDMM (4 dígitos) colados após letra no fim. */
    private static final Pattern DATE_GLUED_DDMM_END = Pattern.compile("(?<=[A-Z])\\d{4}$");
    /** Parcela de cartão no fim, ex.: (2/3). */
    private static final Pattern PARCEL_END = Pattern.compile("\\s*\\(\\d+/\\d+\\)$");
    private static final Pattern TIME_END = Pattern.compile("\\d{2}:\\d{2}(:\\d{2})?$");
    private static final Pattern TRAILING_SEPARATORS = Pattern.compile("[\\s\\-/\\.]+$");

    private DescricaoNormalizer() {}

    public static String normalizar(String descricao) {
        if (descricao == null || descricao.isBlank()) {
            return "";
        }
        String s = descricao.trim().toUpperCase(Locale.ROOT).replaceAll("\\s+", " ");
        s = removerTokensFinaisRepetidamente(s);
        s = TRAILING_SEPARATORS.matcher(s).replaceAll("").trim();
        if (s.length() > MAX_LEN) {
            s = s.substring(0, MAX_LEN);
        }
        return s;
    }

    /** Nome do estabelecimento sem parcela/data — chave para histórico e recorrência por nome. */
    public static String chaveEstabelecimento(String descricao) {
        return normalizar(descricao);
    }

    private static String removerTokensFinaisRepetidamente(String input) {
        String s = input;
        boolean changed;
        do {
            changed = false;
            String prev = s;
            s = stripEndIfMatches(s, DATE_SLASH_END);
            s = stripEndIfMatches(s, DATE_DASH_END);
            s = stripEndIfMatches(s, DATE_DOT_END);
            s = stripEndIfMatches(s, DATE_SEPARATED_END);
            s = stripEndIfMatches(s, DATE_GLUED_END);
            s = stripEndIfMatches(s, DATE_GLUED_DDMM_END);
            s = stripEndIfMatches(s, PARCEL_END);
            s = stripEndIfMatches(s, TIME_END);
            s = TRAILING_SEPARATORS.matcher(s).replaceAll("").trim();
            changed = !s.equals(prev);
        } while (changed && !s.isEmpty());
        return s;
    }

    private static String stripEndIfMatches(String s, Pattern pattern) {
        if (pattern.matcher(s).find()) {
            return pattern.matcher(s).replaceFirst("");
        }
        return s;
    }
}
