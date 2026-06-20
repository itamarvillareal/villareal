package br.com.vilareal.projudi;

import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Metadados do cabeçalho do processo na resposta HTML da consulta PROJUDI (BuscaProcesso).
 */
public final class ProjudiProcessoMetadadosParser {

    private static final DateTimeFormatter FMT_DATA_BR =
            DateTimeFormatter.ofPattern("d/M/uuuu", Locale.ROOT);

    /** Fallback quando o DOM varia ({@code <br/>} entre label e valor, entidades HTML, etc.). */
    private static final Pattern REGEX_DATA_DISTRIBUICAO = Pattern.compile(
            "Dt\\.\\s*Distribui[^<]*</div>\\s*(?:<br\\s*/?>\\s*)*<span[^>]*>([^<]+)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private ProjudiProcessoMetadadosParser() {}

    public static Optional<LocalDate> extrairDataDistribuicao(String html) {
        if (html == null || html.isBlank()) {
            return Optional.empty();
        }
        Optional<LocalDate> viaDom = extrairDataDistribuicao(org.jsoup.Jsoup.parse(html));
        if (viaDom.isPresent()) {
            return viaDom;
        }
        Matcher m = REGEX_DATA_DISTRIBUICAO.matcher(html);
        if (m.find()) {
            return parseDataProjudi(m.group(1));
        }
        return Optional.empty();
    }

    public static Optional<LocalDate> extrairDataDistribuicao(Document doc) {
        if (doc == null) {
            return Optional.empty();
        }
        for (Element div : doc.select("div")) {
            String label = div.ownText();
            if (!ehLabelDataDistribuicao(label)) {
                continue;
            }
            Element cursor = div.nextElementSibling();
            while (cursor != null) {
                if ("br".equalsIgnoreCase(cursor.tagName())) {
                    cursor = cursor.nextElementSibling();
                    continue;
                }
                if ("span".equalsIgnoreCase(cursor.tagName())) {
                    Optional<LocalDate> data = parseDataProjudi(cursor.text());
                    if (data.isPresent()) {
                        return data;
                    }
                }
                break;
            }
        }
        return Optional.empty();
    }

    static boolean ehLabelDataDistribuicao(String texto) {
        if (texto == null || texto.isBlank()) {
            return false;
        }
        String normalizado = Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .trim()
                .toLowerCase(Locale.ROOT);
        return normalizado.startsWith("dt. distribui");
    }

    static Optional<LocalDate> parseDataProjudi(String bruto) {
        if (bruto == null || bruto.isBlank()) {
            return Optional.empty();
        }
        String parteData = bruto.trim().split("\\s+")[0];
        try {
            return Optional.of(LocalDate.parse(parteData, FMT_DATA_BR));
        } catch (DateTimeParseException e) {
            return Optional.empty();
        }
    }
}
