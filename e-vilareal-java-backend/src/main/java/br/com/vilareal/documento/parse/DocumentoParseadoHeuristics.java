package br.com.vilareal.documento.parse;

import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Heurísticas compartilhadas entre parser DOCX e PDF. */
final class DocumentoParseadoHeuristics {

    static final Pattern CNJ = Pattern.compile("\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}");
    static final Pattern LINHA_PROCESSO =
            Pattern.compile("(?i)(?:processo|autos)\\s+n[º°o\\.]*\\s*(.+)");
    static final Pattern TITULO_ROMANO =
            Pattern.compile("(?i)^\\s*(?:[IVXLC]+)\\s*[\\.\\-–—]\\s+.+");
    static final Pattern SUBTITULO_MULTINIVEL =
            Pattern.compile("(?i)^\\s*(?:[IVXLC]+|\\d+)\\s*[\\.\\-–—]\\s*\\d+\\s*[\\.\\-–—]\\s+.+");
    static final Pattern ENUMERACAO =
            Pattern.compile("(?i)^\\s*(?:\\(?[a-z]\\)?|[ivx]+|\\d+)\\s*[\\.\\)]\\s+.+");
    static final Pattern LOCAL_DATA = Pattern.compile(
            "(?i)(Anápolis|Goiânia|[A-ZÁÉÍÓÚÂÊÔÃÇ][a-záéíóúâêôãç]+).+(?:de\\s+)?(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro).+\\d{4}");
    static final Pattern ENDERECAMENTO_JUIZO =
            Pattern.compile("(?i)^(MERITÍSSIMO|EXCELENTÍSSIMO|ILUSTRÍSSIMO|COLENDO|EGRÉGIO|MM\\.|JUÍZO|VARA)");

    private static final Pattern RUIDO_ESCRITORIO = Pattern.compile(
            "(?i)villa\\s*real|pinheiro\\s+chagas|villarealadvocacia|3321-2374|98129-6212");

    private DocumentoParseadoHeuristics() {}

    static boolean textoVazio(String t) {
        return t == null || t.trim().isEmpty();
    }

    static boolean ehRuidoEscritorio(String texto) {
        return StringUtils.hasText(texto) && RUIDO_ESCRITORIO.matcher(texto).find();
    }

    static boolean pareceEnderecamentoJuizo(String texto) {
        return StringUtils.hasText(texto) && ENDERECAMENTO_JUIZO.matcher(texto.trim()).find();
    }

    static boolean contemNumeroProcesso(String texto) {
        return StringUtils.hasText(texto)
                && (CNJ.matcher(texto).find() || LINHA_PROCESSO.matcher(texto).find());
    }

    static String extrairNumeroProcesso(String texto) {
        if (!StringUtils.hasText(texto)) {
            return null;
        }
        Matcher cnj = CNJ.matcher(texto);
        if (cnj.find()) {
            return cnj.group();
        }
        Matcher linha = LINHA_PROCESSO.matcher(texto.trim());
        if (linha.matches()) {
            String resto = linha.group(1).trim();
            Matcher cnj2 = CNJ.matcher(resto);
            return cnj2.find() ? cnj2.group() : resto;
        }
        return null;
    }

    static boolean textoTodoCaps(String texto) {
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        String letras = texto.replaceAll("[^\\p{L}]", "");
        return letras.length() >= 3 && letras.equals(letras.toUpperCase(Locale.ROOT));
    }

    static boolean ehTituloPrincipal(String texto, boolean center, boolean bold) {
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        String t = texto.trim();
        if (TITULO_ROMANO.matcher(t).matches()) {
            return true;
        }
        if (!bold && !center) {
            return false;
        }
        if (bold && (center || textoTodoCaps(t))) {
            String upper = t.toUpperCase(Locale.ROOT);
            return upper.startsWith("DOS ")
                    || upper.startsWith("DO ")
                    || upper.startsWith("DA ")
                    || upper.startsWith("DAS ")
                    || upper.contains("PEDIDO");
        }
        return false;
    }

    /** Classificação de título principal só por texto (PDF sem metadados de formatação). */
    static boolean ehTituloPrincipalTexto(String texto) {
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        String t = texto.trim();
        if (TITULO_ROMANO.matcher(t).matches()) {
            return true;
        }
        if (textoTodoCaps(t) && t.length() <= 100) {
            String upper = t.toUpperCase(Locale.ROOT);
            return upper.startsWith("DOS ")
                    || upper.startsWith("DO ")
                    || upper.startsWith("DA ")
                    || upper.startsWith("DAS ");
        }
        return false;
    }

    static boolean ehSubtitulo(String texto, boolean bold) {
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        String t = texto.trim();
        if (SUBTITULO_MULTINIVEL.matcher(t).matches()) {
            return true;
        }
        return bold && !textoTodoCaps(t) && t.length() <= 120;
    }

    static boolean ehSubtituloTexto(String texto) {
        return StringUtils.hasText(texto) && SUBTITULO_MULTINIVEL.matcher(texto.trim()).matches();
    }

    static boolean ehNomePecaTexto(String texto) {
        if (!StringUtils.hasText(texto) || texto.length() > 80) {
            return false;
        }
        if (!textoTodoCaps(texto.trim())) {
            return false;
        }
        return ehNomePeca(texto, true, true);
    }

    static boolean ehNomePeca(String texto, boolean center, boolean bold) {
        if (!StringUtils.hasText(texto) || texto.length() > 80) {
            return false;
        }
        if (!center || !bold || !textoTodoCaps(texto.trim())) {
            return false;
        }
        String u = texto.toUpperCase(Locale.ROOT);
        return u.contains("RAZÕES")
                || u.contains("RAZOES")
                || u.contains("PETIÇÃO")
                || u.contains("PETICAO")
                || u.contains("CONTESTAÇÃO")
                || u.contains("CONTESTACAO")
                || u.contains("CONTRARRAZ")
                || u.contains("EMBARGOS")
                || u.contains("IMPUGNAÇÃO")
                || u.contains("IMPUGNACAO")
                || u.contains("MANIFESTAÇÃO")
                || u.contains("MANIFESTACAO")
                || u.contains("RECURSO");
    }

    static boolean ehEnumeracao(String texto, boolean temListaNativa) {
        if (temListaNativa) {
            return true;
        }
        return StringUtils.hasText(texto) && ENUMERACAO.matcher(texto.trim()).matches();
    }

    static boolean ehFechoLinha(String texto) {
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        String t = texto.trim().toLowerCase(Locale.ROOT);
        return t.startsWith("nestes termos")
                || t.startsWith("pede deferimento")
                || t.equals("nestes termos,")
                || t.equals("pede deferimento.");
    }

    static boolean ehLocalData(String texto) {
        return StringUtils.hasText(texto) && LOCAL_DATA.matcher(texto.trim()).find();
    }

    static boolean ehAssinatura(String texto, boolean center, boolean bold) {
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        String t = texto.toUpperCase(Locale.ROOT);
        return (center || bold) && (t.contains("OAB") || t.contains("DR.") || t.contains("ITAMAR"));
    }
}
