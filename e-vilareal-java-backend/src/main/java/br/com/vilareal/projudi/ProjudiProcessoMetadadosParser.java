package br.com.vilareal.projudi;

import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Optional;

/**
 * Metadados do cabeçalho do processo na resposta HTML da consulta PROJUDI (BuscaProcesso).
 */
public final class ProjudiProcessoMetadadosParser {

    private static final DateTimeFormatter FMT_DATA_BR =
            DateTimeFormatter.ofPattern("d/M/uuuu", Locale.ROOT);

    private ProjudiProcessoMetadadosParser() {}

    public static Optional<LocalDate> extrairDataDistribuicao(String html) {
        if (html == null || html.isBlank()) {
            return Optional.empty();
        }
        return extrairDataDistribuicao(org.jsoup.Jsoup.parse(html));
    }

    public static Optional<LocalDate> extrairDataDistribuicao(Document doc) {
        if (doc == null) {
            return Optional.empty();
        }
        for (Element div : doc.select("div")) {
            if (!ehLabelDataDistribuicao(div.text())) {
                continue;
            }
            Element proximo = div.nextElementSibling();
            if (proximo != null && "span".equalsIgnoreCase(proximo.tagName())) {
                Optional<LocalDate> data = parseDataProjudi(proximo.text());
                if (data.isPresent()) {
                    return data;
                }
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
        return "dt. distribuicao".equals(normalizado);
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
