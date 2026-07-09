package br.com.vilareal.documento;

import br.com.vilareal.documento.tema.TemaDocumento;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Entities;
import org.jsoup.select.Elements;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/** Monta e interpreta HTML de corpo único para edição WYSIWYG da petição reformatada. */
public final class DocumentoReformatarCorpoUnicoHtml {

    static final String ADVOGADO_NOME_PADRAO = "Dr. Itamar Alexandre Felix Villa Real Junior";
    static final String ADVOGADO_OAB_PADRAO = "OAB/GO 33.329";

    private static final Pattern PREFIXO_PROCESSO =
            Pattern.compile("^\\s*processo\\s*n[º°o\\.\\s]*", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final Pattern LINHA_LOCAL_DATA_CURTA = Pattern.compile(
            "(?iu)(?:anápolis|goiânia).{0,120}(?:estado\\s+de\\s+)?goiás");

    private DocumentoReformatarCorpoUnicoHtml() {}

    /** Cabeçalho timbrado da prévia editável (removido na geração do PDF final). */
    public static String montarCabecalhoEdicaoPreview(String advogadoNome, String advogadoOab) {
        return montarCabecalhoEdicaoPreview(advogadoNome, advogadoOab, TemaDocumento.padrao());
    }

    public static String montarCabecalhoEdicaoPreview(String advogadoNome, String advogadoOab, TemaDocumento tema) {
        TemaDocumento t = tema != null ? tema : TemaDocumento.padrao();
        return montarCabecalhoEdicaoPreview(
                valorOuPadrao(advogadoNome, t.advogadoNomeEfetivo()),
                valorOuPadrao(advogadoOab, t.advogadoOabEfetivo()),
                logoDataUriFromTema(t));
    }

    static String montarCabecalhoEdicaoPreview(String advogadoNome, String advogadoOab, String logoDataUri) {
        StringBuilder sb = new StringBuilder();
        sb.append("<div data-doc-part=\"cabecalho\" contenteditable=\"false\" style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:18pt;\">");
        if (StringUtils.hasText(logoDataUri)) {
            sb.append("<img data-doc-part=\"logo\" contenteditable=\"false\" src=\"")
                    .append(logoDataUri)
                    .append("\" alt=\"Villa Real e Advogados\" style=\"height:88px;width:auto;max-width:224px;object-fit:contain;\" />");
        } else {
            sb.append("<div data-doc-part=\"logo\" contenteditable=\"false\" style=\"font-weight:bold;font-size:14pt;\">VILLA REAL</div>");
        }
        sb.append("<div style=\"text-align:right;flex:1;margin-left:12pt;\">");
        sb.append("<p data-doc-part=\"advogado-nome\" style=\"margin:0;font-style:italic;font-weight:bold;font-size:11pt;\">")
                .append(escapeTexto(advogadoNome))
                .append("</p>");
        sb.append("<p data-doc-part=\"advogado-oab\" style=\"margin:4pt 0 0;font-weight:bold;font-size:11pt;\">")
                .append(escapeTexto(advogadoOab))
                .append("</p>");
        sb.append("</div></div>");
        return sb.toString();
    }

    public static String montar(DocumentoReformatarConteudoRequest req) {
        return montar(req, TemaDocumento.padrao());
    }

    public static String montar(DocumentoReformatarConteudoRequest req, TemaDocumento tema) {
        TemaDocumento t = tema != null ? tema : TemaDocumento.padrao();
        String advogadoNome = valorOuPadrao(req.advogadoNome(), t.advogadoNomeEfetivo());
        String advogadoOab = valorOuPadrao(req.advogadoOab(), t.advogadoOabEfetivo());
        String logo = logoDataUriFromTema(t);

        StringBuilder sb = new StringBuilder();
        sb.append("<div class=\"doc-edicao-preview\" style=\"font-family:Arial,sans-serif;font-size:12pt;line-height:1.35;color:#000;\">");

        sb.append(montarCabecalhoEdicaoPreview(advogadoNome, advogadoOab, logo));

        if (StringUtils.hasText(req.enderecamento())) {
            sb.append("<p data-doc-part=\"enderecamento\" style=\"margin:16pt 0 12pt;font-size:13pt;text-align:justify;\">")
                    .append(escapeTexto(req.enderecamento().trim()))
                    .append("</p>");
        }

        if (StringUtils.hasText(req.numeroProcesso())) {
            sb.append("<p data-doc-part=\"numero-processo\" style=\"margin:0 0 42pt;font-weight:bold;\">Processo nº ")
                    .append(escapeTexto(req.numeroProcesso().trim()))
                    .append("</p>");
        }

        if (StringUtils.hasText(req.preambulo())) {
            sb.append("<div data-doc-part=\"preambulo\" style=\"margin-bottom:18pt;text-align:justify;text-indent:2cm;\">")
                    .append(req.preambulo().trim())
                    .append("</div>");
        }

        if (StringUtils.hasText(req.nomePeca()) && !nomePecaJaNoPreambulo(req.preambulo(), req.nomePeca())) {
            sb.append("<p data-doc-part=\"nome-peca\" style=\"margin:18pt 0;font-weight:bold;text-transform:uppercase;text-align:center;\">")
                    .append(escapeTexto(req.nomePeca().trim()))
                    .append("</p>");
        }

        if (req.secoes() != null) {
            for (DocumentoReformatarConteudoRequest.SecaoConteudo secao : req.secoes()) {
                if (secao == null || !StringUtils.hasText(secao.titulo())) {
                    continue;
                }
                String tipo = StringUtils.hasText(secao.tipoTitulo()) ? secao.tipoTitulo().trim() : "SUB";
                boolean principal = "PRINCIPAL".equalsIgnoreCase(tipo);
                sb.append("<div data-doc-part=\"secao\" data-titulo=\"")
                        .append(escapeAttr(secao.titulo().trim()))
                        .append("\" data-tipo=\"")
                        .append(escapeAttr(tipo))
                        .append("\" style=\"margin-top:18pt;\">");
                if (principal) {
                    sb.append("<p data-doc-part=\"secao-titulo\" style=\"margin:18pt 0 12pt;font-weight:bold;text-transform:uppercase;text-align:center;\">")
                            .append(escapeTexto(secao.titulo().trim()))
                            .append("</p>");
                } else {
                    sb.append("<p data-doc-part=\"secao-titulo\" style=\"margin:15pt 0 10pt;font-weight:bold;text-align:justify;\">")
                            .append(escapeTexto(secao.titulo().trim()))
                            .append("</p>");
                }
                sb.append("<div data-doc-part=\"secao-conteudo\" style=\"text-align:justify;text-indent:4cm;\">")
                        .append(StringUtils.hasText(secao.conteudo()) ? secao.conteudo().trim() : "")
                        .append("</div></div>");
            }
        }

        sb.append("<div data-doc-part=\"fecho\" style=\"margin-top:24pt;\">");
        if (StringUtils.hasText(req.fecho())) {
            sb.append(req.fecho().trim());
        } else {
            sb.append("<p style=\"margin:42pt 0 0;padding-left:2.5cm;\">Nestes termos,</p>");
            sb.append("<p style=\"margin:4pt 0 18pt;padding-left:2.5cm;\">pede deferimento.</p>");
        }
        sb.append("</div>");

        String localData = montarLocalData(req);
        sb.append("<p data-doc-part=\"local-data\" style=\"margin:18pt 0 36pt;text-align:center;\">")
                .append(escapeTexto(localData))
                .append("</p>");

        sb.append("<div data-doc-part=\"assinatura\" style=\"text-align:center;margin-top:36pt;\">");
        sb.append("<p style=\"margin:0;font-weight:bold;\">").append(escapeTexto(advogadoNome)).append("</p>");
        sb.append("<p style=\"margin:0;\">").append(escapeTexto(advogadoOab)).append("</p>");
        sb.append("</div>");

        sb.append("</div>");
        return sb.toString();
    }

    public static DocumentoReformatarConteudoRequest aplicarCorpoUnico(
            DocumentoReformatarConteudoRequest base, String corpoUnicoHtml) {
        if (!StringUtils.hasText(corpoUnicoHtml)) {
            return base;
        }
        Document doc = Jsoup.parseBodyFragment(corpoUnicoHtml.trim());

        String advogadoNome = textoDe(doc, "[data-doc-part=advogado-nome]", ADVOGADO_NOME_PADRAO);
        String advogadoOab = textoDe(doc, "[data-doc-part=advogado-oab]", ADVOGADO_OAB_PADRAO);
        String enderecamento = textoDe(doc, "[data-doc-part=enderecamento]", "");
        String numeroProcesso = extrairNumeroProcesso(textoDe(doc, "[data-doc-part=numero-processo]", ""));
        String preambulo = htmlDe(doc, "[data-doc-part=preambulo]", "");
        String nomePeca = textoDe(doc, "[data-doc-part=nome-peca]", "");
        String fecho = htmlDe(doc, "[data-doc-part=fecho]", "");
        String localData = textoDe(doc, "[data-doc-part=local-data]", null);

        List<DocumentoReformatarConteudoRequest.SecaoConteudo> secoes = new ArrayList<>();
        Elements blocosSecao = doc.select("[data-doc-part=secao]");
        if (!blocosSecao.isEmpty()) {
            for (Element bloco : blocosSecao) {
                String titulo = textoDe(bloco, "[data-doc-part=secao-titulo]", "");
                if (!StringUtils.hasText(titulo)) {
                    titulo = bloco.attr("data-titulo");
                }
                if (!StringUtils.hasText(titulo)) {
                    continue;
                }
                String tipo = bloco.attr("data-tipo");
                if (!StringUtils.hasText(tipo)) {
                    tipo = "SUB";
                }
                Element conteudoEl = bloco.selectFirst("[data-doc-part=secao-conteudo]");
                String conteudo = conteudoEl != null ? conteudoEl.html().trim() : "";
                secoes.add(new DocumentoReformatarConteudoRequest.SecaoConteudo(titulo.trim(), tipo.trim(), conteudo));
            }
        }

        String cidadeEstado = base.cidadeEstado();
        if (StringUtils.hasText(localData)) {
            cidadeEstado = localData.replaceAll("\\.$", "").trim();
        }

        return new DocumentoReformatarConteudoRequest(
                enderecamento,
                numeroProcesso,
                cidadeEstado,
                base.data(),
                nomePeca,
                preambulo,
                secoes,
                fecho,
                advogadoNome,
                advogadoOab,
                corpoUnicoHtml.trim(),
                base.processoId());
    }

    /** Local e data editados no corpo único (linha acima da assinatura). */
    public static String extrairLocalData(String corpoUnicoHtml) {
        if (!StringUtils.hasText(corpoUnicoHtml)) {
            return "";
        }
        Document doc = Jsoup.parseBodyFragment(corpoUnicoHtml.trim());
        String marcado = textoDe(doc, "[data-doc-part=local-data]", "");
        if (StringUtils.hasText(marcado)) {
            return marcado;
        }
        return extrairLocalDataHeuristico(doc);
    }

    /** Fallback quando o editor remove {@code data-doc-part} (contentEditable). */
    static String extrairLocalDataHeuristico(Document doc) {
        Element assinatura = doc.selectFirst("[data-doc-part=assinatura]");
        List<Element> candidatos = new ArrayList<>(doc.select("p, div[data-doc-part=fecho] p"));
        for (int i = candidatos.size() - 1; i >= 0; i--) {
            Element el = candidatos.get(i);
            if (assinatura != null && el.parents().contains(assinatura)) {
                continue;
            }
            if (el.selectFirst("[data-doc-part=assinatura]") != null) {
                continue;
            }
            String t = el.text().trim();
            if (pareceLinhaLocalData(t)) {
                return t;
            }
        }
        return "";
    }

    /** HTML do corpo editado, sem cabeçalho/local-data/assinatura duplicados do template PDF. */
    public static String extrairHtmlParaPdf(String corpoUnicoHtml) {
        if (!StringUtils.hasText(corpoUnicoHtml)) {
            return "";
        }
        Document doc = Jsoup.parseBodyFragment(corpoUnicoHtml.trim());
        doc.select("[data-doc-part=cabecalho]").remove();
        doc.select("[data-doc-part=local-data]").remove();
        doc.select("[data-doc-part=assinatura]").remove();
        Element root = doc.selectFirst(".doc-edicao-preview");
        if (root == null) {
            root = doc.body();
        }
        return sanitizarHtmlParaPdf(root.html());
    }

    /** Normaliza HTML do contentEditable para XHTML exigido pelo OpenHTMLToPDF. */
    static String sanitizarHtmlParaPdf(String html) {
        if (!StringUtils.hasText(html)) {
            return "";
        }
        Document doc = Jsoup.parseBodyFragment(html.trim());
        doc.outputSettings()
                .syntax(Document.OutputSettings.Syntax.xml)
                .escapeMode(Entities.EscapeMode.xhtml)
                .prettyPrint(false);
        return doc.body().html().trim();
    }

    private static String montarLocalData(DocumentoReformatarConteudoRequest req) {
        if (StringUtils.hasText(req.cidadeEstado())) {
            String local = req.cidadeEstado().trim();
            if (local.endsWith(".")) {
                return local;
            }
            return local + ".";
        }
        return "Anápolis, estado de Goiás.";
    }

    private static String extrairNumeroProcesso(String bruto) {
        if (!StringUtils.hasText(bruto)) {
            return "";
        }
        return PREFIXO_PROCESSO.matcher(bruto.trim()).replaceFirst("").trim();
    }

    private static String textoDe(Document doc, String seletor, String fallback) {
        Element el = doc.selectFirst(seletor);
        if (el == null) {
            return fallback != null ? fallback : "";
        }
        String t = el.text().trim();
        return StringUtils.hasText(t) ? t : (fallback != null ? fallback : "");
    }

    private static String textoDe(Element root, String seletor, String fallback) {
        Element el = root.selectFirst(seletor);
        if (el == null) {
            return fallback != null ? fallback : "";
        }
        String t = el.text().trim();
        return StringUtils.hasText(t) ? t : (fallback != null ? fallback : "");
    }

    private static String htmlDe(Document doc, String seletor, String fallback) {
        Element el = doc.selectFirst(seletor);
        if (el == null) {
            return fallback != null ? fallback : "";
        }
        String html = el.html().trim();
        return StringUtils.hasText(html) ? html : (fallback != null ? fallback : "");
    }

    static boolean pareceLinhaLocalData(String texto) {
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        String t = texto.trim();
        if (LINHA_LOCAL_DATA_CURTA.matcher(t).find()) {
            return true;
        }
        return Pattern.compile(
                        "(?iu).+(?:de\\s+)?(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro).+\\d{4}")
                .matcher(t)
                .find();
    }

    private static boolean nomePecaJaNoPreambulo(String preambuloHtml, String nomePeca) {
        if (!StringUtils.hasText(preambuloHtml) || !StringUtils.hasText(nomePeca)) {
            return false;
        }
        String pre = preambuloHtml.toLowerCase(Locale.ROOT);
        return pre.contains("class=\"nome-peca\"") || pre.contains(nomePeca.trim().toLowerCase(Locale.ROOT));
    }

    private static String valorOuPadrao(String valor, String padrao) {
        return StringUtils.hasText(valor) ? valor.trim() : padrao;
    }

    private static String escapeTexto(String texto) {
        if (texto == null) {
            return "";
        }
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escapeAttr(String texto) {
        return escapeTexto(texto).replace("\"", "&quot;");
    }

    /** Logo do timbrado para prévia WYSIWYG (modelo do responsável ou padrão do escritório). */
    public static String logoDataUriFromTema(TemaDocumento tema) {
        TemaDocumento t = tema != null ? tema : TemaDocumento.padrao();
        String embutido = t.logoCabecalhoBase64Efetivo();
        if (StringUtils.hasText(embutido)) {
            String trimmed = embutido.trim();
            return trimmed.startsWith("data:") ? trimmed : "data:image/jpeg;base64," + trimmed;
        }
        return carregarLogoDataUriFromPath(t.logoCabecalhoPathEfetivo());
    }

    private static String carregarLogoDataUriFromPath(String classpathPath) {
        if (!StringUtils.hasText(classpathPath)) {
            return "";
        }
        try {
            ClassPathResource resource = new ClassPathResource(classpathPath.trim());
            if (!resource.exists()) {
                return "";
            }
            byte[] bytes;
            try (InputStream in = resource.getInputStream()) {
                bytes = in.readAllBytes();
            }
            if (bytes.length == 0) {
                return "";
            }
            String mime = classpathPath.toLowerCase(Locale.ROOT).endsWith(".png") ? "image/png" : "image/jpeg";
            return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
        } catch (IOException e) {
            return "";
        }
    }
}
