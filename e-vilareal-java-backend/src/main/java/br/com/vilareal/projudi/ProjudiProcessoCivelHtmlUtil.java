package br.com.vilareal.projudi;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Extrai tokens ocultos das páginas HTML do fluxo {@code /ProcessoCivel}. */
final class ProjudiProcessoCivelHtmlUtil {

    private static final Pattern REVISAO =
            Pattern.compile("Confirmação de Dados|Passo 3|Passo\\+3|value=\"Passo 3\"", Pattern.CASE_INSENSITIVE);

    private static final Pattern HASH_FLUXO_QUERY =
            Pattern.compile("[?&]hashFluxo=([^&\"'\\s<>]+)", Pattern.CASE_INSENSITIVE);

    private ProjudiProcessoCivelHtmlUtil() {}

    record DiagnosticoHashFluxoHtml(
            String hashFluxoQuery,
            String hashInput,
            String hashParteInput,
            String pedidoInput,
            List<String> hashFluxoEmLinks) {}

    /** Linha para trilha: {@code hashFluxo no HTML = ...}. */
    static String formatarLinhaHashFluxoHtml(String html) {
        DiagnosticoHashFluxoHtml d = extrairDiagnosticoHashFluxo(html);
        StringBuilder sb = new StringBuilder("hashFluxo no HTML = ");
        sb.append("hashFluxo(query)=").append(nv(d.hashFluxoQuery()));
        sb.append(" | Hash=").append(nv(d.hashInput()));
        sb.append(" | HashParte=").append(nv(d.hashParteInput()));
        sb.append(" | __Pedido__=").append(nv(d.pedidoInput()));
        if (d.hashFluxoEmLinks() != null && !d.hashFluxoEmLinks().isEmpty()) {
            sb.append(" | links hashFluxo=").append(String.join(",", d.hashFluxoEmLinks()));
        }
        return sb.toString();
    }

    static DiagnosticoHashFluxoHtml extrairDiagnosticoHashFluxo(String html) {
        if (!StringUtils.hasText(html)) {
            return new DiagnosticoHashFluxoHtml(null, null, null, null, List.of());
        }
        TokensFluxo tokens = extrairTokens(html);
        String hashFluxoQuery = primeiroHashFluxoQuery(html);
        List<String> links = new ArrayList<>();
        Matcher m = HASH_FLUXO_QUERY.matcher(html);
        while (m.find()) {
            String v = decUrlSafe(m.group(1).trim());
            if (StringUtils.hasText(v) && !links.contains(v)) {
                links.add(v);
            }
        }
        if (StringUtils.hasText(hashFluxoQuery) && !links.contains(hashFluxoQuery)) {
            links.add(0, hashFluxoQuery);
        }
        return new DiagnosticoHashFluxoHtml(
                hashFluxoQuery,
                tokens.hash(),
                tokens.hashParte(),
                tokens.pedido(),
                List.copyOf(links));
    }

    /** Valor preferido de fluxo visível no HTML (query hashFluxo, depois Hash, depois __Pedido__). */
    static String hashFluxoPreferidoNoHtml(String html) {
        DiagnosticoHashFluxoHtml d = extrairDiagnosticoHashFluxo(html);
        if (StringUtils.hasText(d.hashFluxoQuery())) {
            return d.hashFluxoQuery().trim();
        }
        if (StringUtils.hasText(d.hashInput())) {
            return d.hashInput().trim();
        }
        if (StringUtils.hasText(d.pedidoInput()) && !"null".equalsIgnoreCase(d.pedidoInput().trim())) {
            return d.pedidoInput().trim();
        }
        if (d.hashFluxoEmLinks() != null && !d.hashFluxoEmLinks().isEmpty()) {
            return d.hashFluxoEmLinks().getFirst();
        }
        return null;
    }

    private static String primeiroHashFluxoQuery(String html) {
        Matcher m = HASH_FLUXO_QUERY.matcher(html);
        if (m.find()) {
            return decUrlSafe(m.group(1).trim());
        }
        return null;
    }

    private static String decUrlSafe(String valor) {
        try {
            return java.net.URLDecoder.decode(valor, StandardCharsets.ISO_8859_1);
        } catch (Exception e) {
            return valor;
        }
    }

    private static String nv(String s) {
        return StringUtils.hasText(s) ? s.trim() : "(ausente)";
    }

    record TokensFluxo(String hash, String hashParte, String paginaAtual, String pedido) {}

    static TokensFluxo extrairTokens(String html) {
        if (!StringUtils.hasText(html)) {
            return new TokensFluxo(null, null, null, null);
        }
        Document doc = Jsoup.parse(html);
        return new TokensFluxo(
                valorInput(doc, "Hash"),
                valorInput(doc, "HashParte"),
                valorInput(doc, "PaginaAtual"),
                valorInput(doc, "__Pedido__"));
    }

    static Optional<String> extrairHidden(String html, String name) {
        if (!StringUtils.hasText(html)) {
            return Optional.empty();
        }
        Document doc = Jsoup.parse(html);
        String v = valorInput(doc, name);
        return StringUtils.hasText(v) ? Optional.of(v.trim()) : Optional.empty();
    }

    private static final Pattern HIDDEN_PRIORIDADE =
            Pattern.compile(
                    "name=[\"']Id_ProcessoPrioridade[\"'][^>]*value=[\"'](\\d+)[\"']",
                    Pattern.CASE_INSENSITIVE);

    private static final Pattern LABEL_PRIORIDADE_JS = Pattern.compile(
            "(\\d+)\\s*[=:]\\s*[\"']?[^\"'\\n]{0,80}Maior[^\"'\\n]{0,40}60[^\"'\\n]{0,40}Anos",
            Pattern.CASE_INSENSITIVE);

    /** Rótulos visíveis → {@code value} do {@code <select name=Id_ProcessoPrioridade>}. */
    static Map<String, Integer> extrairOpcoesProcessoPrioridade(String html) {
        Map<String, Integer> out = new LinkedHashMap<>();
        if (!StringUtils.hasText(html)) {
            return out;
        }
        Document doc = Jsoup.parse(html);
        for (Element select : doc.select("select[name=Id_ProcessoPrioridade], select#Id_ProcessoPrioridade")) {
            for (Element option : select.select("option")) {
                adicionarOpcaoPrioridade(out, option.text(), option.attr("value"));
            }
        }
        for (Element option : doc.select("option")) {
            adicionarOpcaoPrioridade(out, option.text(), option.attr("value"));
        }
        Matcher hidden = HIDDEN_PRIORIDADE.matcher(html);
        while (hidden.find()) {
            adicionarOpcaoPrioridade(out, extrairRotuloPrioridadeProximo(html, hidden.start()), hidden.group(1));
        }
        Matcher js = LABEL_PRIORIDADE_JS.matcher(html);
        while (js.find()) {
            adicionarOpcaoPrioridade(out, ProjudiPrioridadeProcessoInicial.MAIOR_60_ANOS.rotulo(), js.group(1));
        }
        return out;
    }

    static String extrairTrechoPrioridade(String html) {
        if (!StringUtils.hasText(html)) {
            return "(html vazio)";
        }
        String lower = html.toLowerCase(Locale.ROOT);
        int idx = lower.indexOf("processoprioridade");
        if (idx < 0) {
            idx = lower.indexOf("prioridade");
        }
        if (idx < 0) {
            return "(sem 'prioridade' no html)";
        }
        int ini = Math.max(0, idx - 120);
        int fim = Math.min(html.length(), idx + 280);
        return html.substring(ini, fim).replaceAll("\\s+", " ").trim();
    }

    private static void adicionarOpcaoPrioridade(Map<String, Integer> out, String rotulo, String value) {
        if (!StringUtils.hasText(rotulo) || !StringUtils.hasText(value)) {
            return;
        }
        try {
            out.putIfAbsent(rotulo.trim(), Integer.parseInt(value.trim()));
        } catch (NumberFormatException ignored) {
            // ignora opção sem id numérico
        }
    }

    private static String extrairRotuloPrioridadeProximo(String html, int posHidden) {
        int ini = Math.max(0, posHidden - 400);
        int fim = Math.min(html.length(), posHidden + 400);
        String trecho = html.substring(ini, fim);
        Matcher m = Pattern.compile("ProcessoPrioridade[\"'][^>]*value=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE)
                .matcher(trecho);
        if (m.find()) {
            return decUrlSafe(m.group(1));
        }
        return "";
    }

    static Optional<Integer> idProcessoPrioridadePorRotulo(String html, String rotuloAlvo) {
        if (!StringUtils.hasText(rotuloAlvo)) {
            return Optional.empty();
        }
        String alvoNorm = normalizarRotuloPrioridade(rotuloAlvo);
        Integer melhorId = null;
        int melhorScore = -1;
        for (Map.Entry<String, Integer> e : extrairOpcoesProcessoPrioridade(html).entrySet()) {
            String rotuloNorm = normalizarRotuloPrioridade(e.getKey());
            if (rotuloNorm.equals(alvoNorm)) {
                return Optional.of(e.getValue());
            }
            if (rotuloNorm.contains(alvoNorm) || alvoNorm.contains(rotuloNorm)) {
                int score = Math.min(rotuloNorm.length(), alvoNorm.length());
                if (score > melhorScore) {
                    melhorScore = score;
                    melhorId = e.getValue();
                }
            }
        }
        return melhorId != null ? Optional.of(melhorId) : Optional.empty();
    }

    static String formatarOpcoesProcessoPrioridade(String html) {
        List<String> partes = new ArrayList<>();
        extrairOpcoesProcessoPrioridade(html)
                .forEach((rotulo, id) -> partes.add(id + "=" + rotulo));
        return partes.isEmpty() ? "(select Id_ProcessoPrioridade ausente)" : String.join(", ", partes);
    }

    private static String normalizarRotuloPrioridade(String rotulo) {
        if (rotulo == null) {
            return "";
        }
        String semAcento = Normalizer.normalize(rotulo, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return semAcento
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }

    static boolean pareceRevisao(String html) {
        if (!StringUtils.hasText(html)) {
            return false;
        }
        return REVISAO.matcher(html).find();
    }

    static String hashFluxoPreferido(TokensFluxo tokens) {
        if (tokens == null) {
            return null;
        }
        if (StringUtils.hasText(tokens.hash())) {
            return tokens.hash().trim();
        }
        if (StringUtils.hasText(tokens.pedido())) {
            return tokens.pedido().trim();
        }
        return null;
    }

    static Matcher matcherCampo(String html, String name) {
        Pattern p = Pattern.compile(
                "name=[\"']" + Pattern.quote(name) + "[\"'][^>]*value=[\"']([^\"']*)[\"']",
                Pattern.CASE_INSENSITIVE);
        return p.matcher(html == null ? "" : html);
    }

    private static String valorInput(Document doc, String name) {
        Element el = doc.selectFirst("input[name=" + name + "], input#" + name);
        if (el == null) {
            return null;
        }
        String value = el.attr("value");
        if (!StringUtils.hasText(value)) {
            value = el.text();
        }
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    static String formatarCpfBusca(String digitos) {
        if (digitos == null || digitos.length() != 11) {
            return digitos;
        }
        return digitos.substring(0, 3)
                + "."
                + digitos.substring(3, 6)
                + "."
                + digitos.substring(6, 9)
                + "-"
                + digitos.substring(9, 11);
    }

    static String formatarCnpjBusca(String digitos) {
        if (digitos == null || digitos.length() != 14) {
            return digitos;
        }
        return digitos.substring(0, 2)
                + "."
                + digitos.substring(2, 5)
                + "."
                + digitos.substring(5, 8)
                + "/"
                + digitos.substring(8, 12)
                + "-"
                + digitos.substring(12, 14);
    }
}
