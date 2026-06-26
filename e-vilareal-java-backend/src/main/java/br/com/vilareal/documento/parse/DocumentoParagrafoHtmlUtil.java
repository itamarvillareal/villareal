package br.com.vilareal.documento.parse;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/** Converte parágrafos formatados ↔ HTML simples para edição na prévia. */
public final class DocumentoParagrafoHtmlUtil {

    private DocumentoParagrafoHtmlUtil() {}

    public static String paragrafosToHtml(List<ParagrafoDocumento> paragrafos) {
        if (paragrafos == null || paragrafos.isEmpty()) {
            return "";
        }
        return paragrafos.stream().map(DocumentoParagrafoHtmlUtil::paragrafoToHtml).collect(Collectors.joining());
    }

    public static String paragrafoToHtml(ParagrafoDocumento paragrafo) {
        if (paragrafo == null) {
            return "";
        }
        String cls =
                switch (paragrafo.tipo()) {
                    case ENUMERACAO -> "enumeracao";
                    case FECHO -> "fecho";
                    case CITACAO -> "citacao";
                    case NOME_PECA -> "nome-peca";
                    default -> "corpo";
                };
        return "<p class=\"" + cls + "\">" + runsToHtml(paragrafo.conteudo()) + "</p>";
    }

    /** Garante {@code <p class="corpo">} com recuo e espaçamento no PDF (modo manual/IA). */
    public static String normalizarHtmlLegadoCorpo(String html) {
        return paragrafosToHtml(htmlToParagrafosLegado(html, TipoParagrafo.CORPO));
    }

    /** Preâmbulo legado: parágrafos com classe para o CSS de {@code .preambulo-rich p.corpo}. */
    public static String normalizarHtmlLegadoPreambulo(String html) {
        return paragrafosToHtml(htmlToParagrafosLegado(html, TipoParagrafo.CORPO));
    }

    private static List<ParagrafoDocumento> htmlToParagrafosLegado(String html, TipoParagrafo tipoPadrao) {
        if (!StringUtils.hasText(html)) {
            return List.of();
        }
        String trimmed = html.trim();
        if (!trimmed.contains("<")) {
            return splitPlainTextToParagrafos(trimmed, tipoPadrao);
        }
        var doc = Jsoup.parseBodyFragment(trimmed);
        if (doc.body().children().isEmpty()) {
            String texto = doc.body().wholeText();
            if (StringUtils.hasText(texto)) {
                return splitPlainTextToParagrafos(texto, tipoPadrao);
            }
            return List.of();
        }
        return htmlToParagrafos(trimmed, tipoPadrao);
    }

    private static List<ParagrafoDocumento> splitPlainTextToParagrafos(String texto, TipoParagrafo tipo) {
        String normalized = texto.replace("\r\n", "\n").trim();
        if (!StringUtils.hasText(normalized)) {
            return List.of();
        }
        String[] blocos;
        if (normalized.contains("\n\n")) {
            blocos = normalized.split("\\n\\s*\\n");
        } else if (normalized.contains("\n")) {
            blocos = normalized.split("\\n");
        } else {
            blocos = new String[] {normalized};
        }
        List<ParagrafoDocumento> resultado = new ArrayList<>();
        for (String bloco : blocos) {
            String t = bloco.replace('\n', ' ').replaceAll("\\s+", " ").trim();
            if (StringUtils.hasText(t)) {
                resultado.add(new ParagrafoDocumento(tipo, List.of(new TextoFormatado(t, false, false, false))));
            }
        }
        return resultado;
    }

    public static List<ParagrafoDocumento> htmlToParagrafos(String html, TipoParagrafo tipoPadrao) {
        if (!StringUtils.hasText(html)) {
            return List.of();
        }
        var doc = Jsoup.parseBodyFragment(html.trim());
        List<ParagrafoDocumento> resultado = new ArrayList<>();
        if (doc.body().children().isEmpty()) {
            String texto = doc.body().text();
            if (StringUtils.hasText(texto)) {
                resultado.add(new ParagrafoDocumento(tipoPadrao, List.of(new TextoFormatado(texto.trim(), false, false, false))));
            }
            return resultado;
        }
        for (Element el : doc.body().children()) {
            TipoParagrafo tipo = tipoFromClass(el.className(), tipoPadrao);
            List<TextoFormatado> runs = parseRuns(el);
            if (!runs.isEmpty()) {
                resultado.add(new ParagrafoDocumento(tipo, runs));
            }
        }
        return resultado;
    }

    private static String runsToHtml(List<TextoFormatado> runs) {
        if (runs == null || runs.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (TextoFormatado r : runs) {
            sb.append(runToHtml(r));
        }
        return sb.toString();
    }

    private static String runToHtml(TextoFormatado r) {
        String t = escapeHtml(r.texto());
        if (!StringUtils.hasText(t)) {
            return "";
        }
        if (r.negrito() && r.italico()) {
            t = "<strong><em>" + t + "</em></strong>";
        } else if (r.negrito()) {
            t = "<strong>" + t + "</strong>";
        } else if (r.italico()) {
            t = "<em>" + t + "</em>";
        }
        if (r.sublinhado()) {
            t = "<u>" + t + "</u>";
        }
        if (r.destacado()) {
            t = "<mark>" + t + "</mark>";
        }
        return t;
    }

    private static List<TextoFormatado> parseRuns(Element el) {
        List<TextoFormatado> runs = new ArrayList<>();
        parseRunsRec(el, runs, false, false, false, false);
        if (runs.isEmpty()) {
            String texto = el.text();
            if (StringUtils.hasText(texto)) {
                runs.add(new TextoFormatado(texto.trim(), false, false, false));
            }
        }
        return runs;
    }

    private static void parseRunsRec(
            Node node,
            List<TextoFormatado> runs,
            boolean negrito,
            boolean italico,
            boolean sublinhado,
            boolean destacado) {
        if (node instanceof TextNode tn) {
            String t = tn.text();
            if (StringUtils.hasText(t)) {
                runs.add(new TextoFormatado(t, negrito, italico, false, sublinhado, destacado));
            }
            return;
        }
        if (!(node instanceof Element el)) {
            return;
        }
        String tag = el.tagName().toLowerCase(Locale.ROOT);
        boolean n = negrito || tag.equals("strong") || tag.equals("b");
        boolean i = italico || tag.equals("em") || tag.equals("i");
        boolean s = sublinhado || tag.equals("u");
        boolean d = destacado || tag.equals("mark");
        for (Node child : el.childNodes()) {
            parseRunsRec(child, runs, n, i, s, d);
        }
    }

    private static TipoParagrafo tipoFromClass(String className, TipoParagrafo padrao) {
        if (!StringUtils.hasText(className)) {
            return padrao;
        }
        String c = className.toLowerCase(Locale.ROOT);
        if (c.contains("enumeracao")) {
            return TipoParagrafo.ENUMERACAO;
        }
        if (c.contains("fecho")) {
            return TipoParagrafo.FECHO;
        }
        if (c.contains("citacao")) {
            return TipoParagrafo.CITACAO;
        }
        if (c.contains("nome-peca")) {
            return TipoParagrafo.NOME_PECA;
        }
        return padrao;
    }

    private static String escapeHtml(String texto) {
        if (texto == null) {
            return "";
        }
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
