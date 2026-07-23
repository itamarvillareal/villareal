package br.com.vilareal.projudi;

import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.util.StringUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Scraping do formulário de revisão (Passo 3) e extração do número gerado após distribuir. */
final class ProjudiProcessoCivelRevisaoHtmlUtil {

    private static final Pattern ONCLICK_PAGINA =
            Pattern.compile("AlterarValue\\(['\"]PaginaAtual['\"]\\s*,\\s*['\"]?([^'\");]+)", Pattern.CASE_INSENSITIVE);

    private static final Pattern CNJ_HIFEN =
            Pattern.compile("\\b(\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4})\\b");

    private static final Pattern CNJ_PONTO =
            Pattern.compile("\\b(\\d{7}\\.\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4})\\b");

    private static final Pattern PROCESSO_NUMERO_QUERY = Pattern.compile(
            "[?&](?:ProcessoNumero|numeroProcesso|numero)=([^&\"'\\s<>]+)", Pattern.CASE_INSENSITIVE);

    private static final Pattern SPAN_PROC_NUMERO = Pattern.compile(
            "id=[\"']span_proc_numero[\"'][^>]*>\\s*([^<\\s]+)", Pattern.CASE_INSENSITIVE);

    private static final Pattern NUMERO_PROCESSO_ANCHOR = Pattern.compile(
            "id=[\"']numeroProcesso[\"'][^>]*>\\s*([^<\\s]+)", Pattern.CASE_INSENSITIVE);

    private static final Pattern MENSAGEM_OK_JS =
            Pattern.compile("mensagemOk\\s*=\\s*'((?:\\\\'|[^'])*)'", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final Pattern MENSAGEM_ERRO_JS =
            Pattern.compile("mensagemErro\\s*=\\s*'((?:\\\\'|[^'])*)'", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final Pattern TITULO_ERRO_JS =
            Pattern.compile("tituloErro\\s*=\\s*'((?:\\\\'|[^'])*)'", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    static final int DIAGNOSTICO_DESTINO_MAX = 800;

    private ProjudiProcessoCivelRevisaoHtmlUtil() {}

    record FormularioRevisao(String action, Map<String, String> campos, String botaoNome, String botaoValor) {

        FormularioRevisao comOpcoesPasso3(ProjudiInicialOpcoesPasso3 opcoes) {
            Map<String, String> camposNovos = new LinkedHashMap<>(campos);
            if (opcoes != null) {
                opcoes.aplicarEmCampos(camposNovos);
            }
            return new FormularioRevisao(action, camposNovos, botaoNome, botaoValor);
        }

        String montarCorpoPostIso8859() {
            Map<String, String> camposFiltrados = filtrarCamposPasso3Final(campos);
            List<String> partes = new ArrayList<>();
            for (Map.Entry<String, String> e : camposFiltrados.entrySet()) {
                partes.add(encIso(e.getKey()) + "=" + encIso(e.getValue()));
            }
            partes.add(encIso(botaoNome) + "=" + encIso(botaoValor));
            return String.join("&", partes);
        }

        /** Todos os campos do POST final (name=value), para trilha de diagnóstico. */
        String descreverCorpoPostLegivel() {
            Map<String, String> camposFiltrados = filtrarCamposPasso3Final(campos);
            List<String> partes = new ArrayList<>();
            for (Map.Entry<String, String> e : camposFiltrados.entrySet()) {
                partes.add(e.getKey() + "=" + e.getValue());
            }
            partes.add(botaoNome + "=" + botaoValor);
            return String.join("&", partes);
        }
    }

    record ExtracaoNumero(String numero, String detalhe) {}

    /** Caminho relativo PROJUDI para GET após redirect (ex.: {@code BuscaProcesso?Id_Processo=...}). */
    static String caminhoGetPosRedirect(String locationHeader) {
        if (!StringUtils.hasText(locationHeader)) {
            return "";
        }
        String loc = locationHeader.trim();
        if (loc.startsWith("http://") || loc.startsWith("https://")) {
            try {
                java.net.URI uri = java.net.URI.create(loc);
                String path = uri.getRawPath();
                String query = uri.getRawQuery();
                if (!StringUtils.hasText(path)) {
                    return loc;
                }
                return StringUtils.hasText(query) ? path.substring(1) + "?" + query : path.substring(1);
            } catch (IllegalArgumentException e) {
                return loc;
            }
        }
        while (loc.startsWith("/")) {
            loc = loc.substring(1);
        }
        return loc;
    }

    /**
     * Redirect pós-distribuição que descarta o rascunho e volta à Área do Advogado
     * ({@code /Usuario?PaginaAtual=-10&...}).
     */
    static boolean pareceRedirect302DescarteUsuario(String locationHeader) {
        if (!StringUtils.hasText(locationHeader)) {
            return false;
        }
        String loc = locationHeader.trim();
        String lower = loc.toLowerCase(Locale.ROOT);
        if (!lower.contains("usuario")) {
            return false;
        }
        if (lower.contains("paginaatual=-10") || lower.contains("paginaatual%3d-10")) {
            return true;
        }
        try {
            String dec = java.net.URLDecoder.decode(loc, StandardCharsets.ISO_8859_1);
            return dec.toLowerCase(Locale.ROOT).contains("paginaatual=-10");
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /** Rótulo legível para trilha/diagnóstico do redirect pós-distribuição. */
    static String rotuloClassificacaoRedirect302Distribuicao(String locationHeader) {
        if (!StringUtils.hasText(locationHeader)) {
            return "INDETERMINADO (Location ausente)";
        }
        if (pareceRedirect302DescarteUsuario(locationHeader)) {
            return "DESCARTE (Usuario PaginaAtual=-10)";
        }
        return "SUCESSO_PROVAVEL (destino do processo)";
    }

    static Optional<ExtracaoNumero> extrairNumeroProcessoGerado(String html, String locationHeader) {
        Optional<ExtracaoNumero> doLocation = extrairNumeroDoLocation(locationHeader);
        if (doLocation.isPresent()) {
            return doLocation;
        }
        if (StringUtils.hasText(html)) {
            Optional<ExtracaoNumero> doHtml = extrairNumeroDoHtmlProcesso(html);
            if (doHtml.isPresent()) {
                return doHtml;
            }
        }
        return Optional.empty();
    }

    private static Optional<ExtracaoNumero> extrairNumeroDoLocation(String locationHeader) {
        if (!StringUtils.hasText(locationHeader)) {
            return Optional.empty();
        }
        Matcher q = PROCESSO_NUMERO_QUERY.matcher(locationHeader);
        if (q.find()) {
            String bruto = decUrl(q.group(1));
            Optional<String> norm = normalizarNumeroCnj(bruto);
            if (norm.isPresent()) {
                return Optional.of(new ExtracaoNumero(norm.get(), "Location query: " + truncar(locationHeader, 500)));
            }
        }
        Optional<String> cnjLoc = primeiroCnj(locationHeader);
        if (cnjLoc.isPresent()) {
            return Optional.of(new ExtracaoNumero(cnjLoc.get(), "CNJ no Location: " + truncar(locationHeader, 500)));
        }
        return Optional.empty();
    }

    private static Optional<ExtracaoNumero> extrairNumeroDoHtmlProcesso(String html) {
        Matcher anchor = NUMERO_PROCESSO_ANCHOR.matcher(html);
        if (anchor.find()) {
            Optional<String> norm = normalizarNumeroCnj(anchor.group(1).trim());
            if (norm.isPresent()) {
                return Optional.of(new ExtracaoNumero(norm.get(), "#numeroProcesso"));
            }
        }
        if (StringUtils.hasText(html)
                && html.toLowerCase(Locale.ROOT).contains("processo cadastrado com sucesso")) {
            Document doc = org.jsoup.Jsoup.parse(html);
            Element el = doc.selectFirst("#numeroProcesso");
            if (el != null) {
                Optional<String> norm = normalizarNumeroCnj(el.text().trim());
                if (norm.isPresent()) {
                    return Optional.of(new ExtracaoNumero(norm.get(), "Confirmação cadastro #numeroProcesso"));
                }
            }
        }
        Matcher span = SPAN_PROC_NUMERO.matcher(html);
        if (span.find()) {
            Optional<String> norm = normalizarNumeroCnj(span.group(1).trim());
            if (norm.isPresent()) {
                return Optional.of(new ExtracaoNumero(norm.get(), "#span_proc_numero"));
            }
        }
        Matcher msg = MENSAGEM_OK_JS.matcher(html);
        if (msg.find()) {
            Optional<String> cnjMsg = primeiroCnj(msg.group(1));
            if (cnjMsg.isPresent()) {
                return Optional.of(new ExtracaoNumero(cnjMsg.get(), "mensagemOk: " + truncar(msg.group(1), 120)));
            }
        }
        Optional<String> cnjHtml = primeiroCnj(html);
        if (cnjHtml.isPresent()) {
            int idx = html.indexOf(cnjHtml.get());
            int ini = Math.max(0, idx - 40);
            int fim = Math.min(html.length(), idx + cnjHtml.get().length() + 40);
            return Optional.of(
                    new ExtracaoNumero(cnjHtml.get(), "HTML trecho: " + truncar(html.substring(ini, fim), 120)));
        }
        return Optional.empty();
    }

    /** Página HTML do PROJUDI com título «Problema no pedido» (token/anexo/validação). */
    static boolean parecePaginaProblemaNoPedido(String html) {
        if (!StringUtils.hasText(html)) {
            return false;
        }
        String lower = html.toLowerCase(Locale.ROOT);
        return lower.contains("<title>problema no pedido</title>")
                || lower.contains("problema no pedido");
    }

    /** Trecho legível da página de destino após redirect 302 (mensagens de erro/validação). */
    static String extrairTrechoDiagnosticoDestino302(String html) {
        if (!StringUtils.hasText(html)) {
            return "(HTML vazio)";
        }
        List<String> partes = new ArrayList<>();

        Document doc = org.jsoup.Jsoup.parse(html);
        Element title = doc.selectFirst("title");
        if (title != null && StringUtils.hasText(title.text())) {
            String t = title.text().trim();
            if (!"projudi".equalsIgnoreCase(t)) {
                partes.add("title: " + t);
            }
        }

        Matcher titulo = TITULO_ERRO_JS.matcher(html);
        if (titulo.find()) {
            String t = decEscJs(titulo.group(1));
            if (mensagemJsRelevante(t)) {
                partes.add("tituloErro: " + t);
            }
        }
        Matcher err = MENSAGEM_ERRO_JS.matcher(html);
        if (err.find()) {
            String msg = decEscJs(err.group(1));
            if (mensagemJsRelevante(msg)) {
                partes.add("mensagemErro: " + msg);
            }
        }

        for (String sel :
                List.of(
                        ".mensagemErro",
                        "#mensagemErro",
                        ".msgErro",
                        "div.erro",
                        "span.erro",
                        "font[color=red]",
                        "#conteudo",
                        "td.mensagem",
                        "div#mensagem")) {
            for (Element el : doc.select(sel)) {
                String t = el.text().trim();
                if (StringUtils.hasText(t) && t.length() >= 4 && !partes.contains(t)) {
                    partes.add(t);
                }
            }
        }

        String plain = doc.body() != null ? doc.body().text() : doc.text();
        for (String chunk : plain.split("\\s{2,}|\\n")) {
            String linha = chunk.trim();
            if (linha.length() < 8 || partes.contains(linha)) {
                continue;
            }
            String lower = linha.toLowerCase(Locale.ROOT);
            if (lower.contains("erro")
                    || lower.contains("obrigat")
                    || lower.contains("inválido")
                    || lower.contains("invalido")
                    || lower.contains("preencha")
                    || lower.contains("atenção")
                    || lower.contains("atencao")
                    || lower.contains("problema")
                    || lower.contains("pedido")
                    || (lower.contains("campo") && (lower.contains("deve") || lower.contains("inform")))) {
                partes.add(linha);
            }
        }

        if (partes.isEmpty()) {
            return truncar(plain.replaceAll("\\s+", " ").trim(), DIAGNOSTICO_DESTINO_MAX);
        }
        return truncar(String.join(" | ", partes), DIAGNOSTICO_DESTINO_MAX);
    }

    static String formatarCorpoPasso3(FormularioRevisao form) {
        if (form == null) {
            return "(formulário ausente)";
        }
        return "action=" + form.action() + " | " + form.descreverCorpoPostLegivel();
    }

    /** Valor de {@code __Pedido__} capturado do form (não é hashFluxo). */
    static String pedidoValorNoFormulario(FormularioRevisao form) {
        if (form == null || form.campos() == null) {
            return null;
        }
        String v = form.campos().get("__Pedido__");
        return StringUtils.hasText(v) ? v.trim() : null;
    }

    static Optional<FormularioRevisao> extrairFormularioDistribuicao(String html) {
        if (!StringUtils.hasText(html)) {
            return Optional.empty();
        }
        Document doc = org.jsoup.Jsoup.parse(html);
        Element form = doc.selectFirst("form#Formulario, form[name=Formulario]");
        if (form == null) {
            return Optional.empty();
        }
        Element botao = localizarBotaoDistribuir(form);
        if (botao == null) {
            return Optional.empty();
        }
        Map<String, String> campos = new LinkedHashMap<>();
        for (Element input : form.select("input[type=hidden]")) {
            String name = input.attr("name");
            if (!StringUtils.hasText(name) || ehCampoProibidoPasso3(name)) {
                continue;
            }
            campos.put(name, valorInput(input));
        }
        for (Element input : form.select("input[type=checkbox]")) {
            String name = input.attr("name");
            if (!StringUtils.hasText(name) || ehCampoProibidoPasso3(name)) {
                continue;
            }
            if (input.hasAttr("checked")) {
                campos.put(name, valorInput(input));
            }
        }
        aplicarOverridePaginaAtual(botao, campos);
        campos.keySet().removeIf(ProjudiProcessoCivelRevisaoHtmlUtil::ehCampoProibidoPasso3);
        String action = form.attr("action");
        if (!StringUtils.hasText(action)) {
            action = "ProcessoCivel";
        }
        return Optional.of(new FormularioRevisao(
                action.trim(), campos, botao.attr("name"), botao.attr("value")));
    }

    private static boolean ehCampoProibidoPasso3(String name) {
        return false;
    }

    /**
     * Campos opcionais do Passo 3 — estado final definido por {@link ProjudiInicialOpcoesPasso3} na distribuição.
     */
    static Map<String, String> filtrarCamposPasso3Final(Map<String, String> campos) {
        Map<String, String> filtrados = new LinkedHashMap<>();
        if (campos == null) {
            return filtrados;
        }
        for (Map.Entry<String, String> e : campos.entrySet()) {
            if (ehCampoProibidoPasso3(e.getKey())) {
                continue;
            }
            filtrados.put(e.getKey(), e.getValue());
        }
        return filtrados;
    }

    private static Element localizarBotaoDistribuir(Element form) {
        Elements candidatos = form.select("input[type=submit], button[type=submit], input[type=button]");
        Element preferido = null;
        for (Element el : candidatos) {
            String name = el.attr("name");
            String value = el.attr("value");
            if (!StringUtils.hasText(name)) {
                continue;
            }
            String valorNorm = normalizarTexto(value);
            if (valorNorm.contains("confirmar")
                    || valorNorm.contains("distribuir")
                    || valorNorm.contains("concluir")) {
                if ("imginserir".equals(name.toLowerCase(Locale.ROOT)) && valorNorm.contains("confirmar")) {
                    return el;
                }
                if (preferido == null) {
                    preferido = el;
                }
            }
        }
        if (preferido != null) {
            return preferido;
        }
        return form.selectFirst("input[name=imgInserir][type=submit]");
    }

    private static void aplicarOverridePaginaAtual(Element botao, Map<String, String> campos) {
        String onclick = botao.attr("onclick");
        if (!StringUtils.hasText(onclick)) {
            return;
        }
        Matcher m = ONCLICK_PAGINA.matcher(onclick);
        if (m.find()) {
            campos.put("PaginaAtual", m.group(1).trim());
        }
    }

    private static String valorInput(Element input) {
        if (input.hasAttr("value")) {
            return input.attr("value");
        }
        return input.text();
    }

    private static Optional<String> primeiroCnj(String texto) {
        if (!StringUtils.hasText(texto)) {
            return Optional.empty();
        }
        Matcher h = CNJ_HIFEN.matcher(texto);
        if (h.find()) {
            return Optional.of(h.group(1));
        }
        Matcher p = CNJ_PONTO.matcher(texto);
        if (p.find()) {
            return Optional.of(p.group(1));
        }
        return Optional.empty();
    }

    private static Optional<String> normalizarNumeroCnj(String bruto) {
        if (!StringUtils.hasText(bruto)) {
            return Optional.empty();
        }
        return primeiroCnj(bruto.trim());
    }

    private static String normalizarTexto(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    private static String encIso(String valor) {
        if (valor == null) {
            return "";
        }
        return URLEncoder.encode(valor, StandardCharsets.ISO_8859_1);
    }

    private static String decUrl(String valor) {
        try {
            return java.net.URLDecoder.decode(valor, StandardCharsets.ISO_8859_1);
        } catch (Exception e) {
            return valor;
        }
    }

    private static String decEscJs(String valor) {
        if (valor == null) {
            return "";
        }
        return valor.replace("\\'", "'").replace("\\\"", "\"").trim();
    }

    private static boolean mensagemJsRelevante(String msg) {
        if (!StringUtils.hasText(msg)) {
            return false;
        }
        String t = msg.trim();
        return !"null".equalsIgnoreCase(t);
    }

    private static String truncar(String s, int max) {
        if (s == null) {
            return "";
        }
        if (s.length() <= max) {
            return s;
        }
        return s.substring(0, max - 3) + "...";
    }
}
