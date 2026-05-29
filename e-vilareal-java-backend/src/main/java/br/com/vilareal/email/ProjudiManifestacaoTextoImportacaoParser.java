package br.com.vilareal.email;

import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parser de emails do Projudi TJGO ({@code sistema-projudi@tjgo.jus.br}): movimentações, intimações, arquivamentos etc.
 */
final class ProjudiManifestacaoTextoImportacaoParser {

    private static final Logger log = LoggerFactory.getLogger(ProjudiManifestacaoTextoImportacaoParser.class);

    private static final Pattern CNJ = Pattern.compile(
            "\\b(\\d{7})\\s*[-–]\\s*(\\d{2})\\s*\\.\\s*(\\d{4})\\s*\\.\\s*(\\d)\\s*\\.\\s*(\\d{2})\\s*\\.\\s*(\\d{4})\\b",
            Pattern.CASE_INSENSITIVE);

    /** CNJ em 20 dígitos contínuos (comum em links e tabelas HTML do Projudi). */
    private static final Pattern CNJ_20_DIGITOS = Pattern.compile("\\b(\\d{20})\\b");

    private static final Pattern RE_INICIO_BLOCO = Pattern.compile(
            "(?is)(?:^|\\n)\\s*(?:"
                    + "Processo|N[uú]mero(?:\\s+do\\s+[Pp]rocesso)?|N[ºo°]\\.?\\s*(?:do\\s+)?[Pp]rocesso"
                    + "|Informa[çc][aã]o\\s+de\\s+intima[çc][aã]o/cita[çc][aã]o"
                    + ")\\s*[:.]?\\s*(?:\\n\\s*|\\s+)"
                    + "(\\d{7}\\s*[-–]\\s*\\d{2}\\s*\\.\\s*\\d{4}\\s*\\.\\s*\\d\\s*\\.\\s*\\d{2}\\s*\\.\\s*\\d{4})");

    private static final Pattern RE_MOVIMENTACAO = Pattern.compile(
            "(?is)(?:Movimenta[çc][aã]o|Tipo\\s+de\\s+[Mm]ovimenta[çc][aã]o|Evento|"
                    + "Informa[çc][aã]o)\\s*[:.]?\\s*([^\\n]{3,240})");

    private static final Pattern RE_DATA_MOV = Pattern.compile(
            "(?is)(?:Data(?:\\s+da\\s+movimenta[çc][aã]o)?|Data/Hora)\\s*[:.]?\\s*(\\d{1,2}/\\d{1,2}/\\d{2,4}(?:\\s+\\d{1,2}:\\d{2})?)");

    private static final Pattern RE_PARTE_AUTOR = Pattern.compile(
            "(?im)^\\s*(?:Autor(?:a)?|Requerente|Parte\\s+[Aa]utora|Polo\\s+[Aa]tivo)\\s*[:.]?\\s*(.+)$");

    private static final Pattern RE_PARTE_REU = Pattern.compile(
            "(?im)^\\s*(?:R[eé]u|Requerid[oa]|Parte\\s+[Rr][eé]|Polo\\s+[Pp]assivo)\\s*[:.]?\\s*(.+)$");

    /** Parâmetros de URL comuns no Projudi (processo em 20 dígitos). */
    private static final Pattern RE_URL_PROCESSO_20 = Pattern.compile(
            "(?i)(?:processo|numero|numeroProcesso|idProcesso|codProcesso)[^=]{0,20}=\\s*(\\d{20})");

    /**
     * Número interno Projudi (ex.: {@code 5868881.58}) — formato usual em emails de intimação/citação
     * sem CNJ completo no corpo.
     */
    private static final Pattern RE_NUMERO_PROJUDI_INTERNO = Pattern.compile(
            "(?i)(?:referente\\s+ao\\s+)?processo\\s+n[ºo°]\\.?\\s*(\\d{4,9})\\.(\\d{2})\\b");

    private static final Pattern RE_DATA_GERADA_EMAIL = Pattern.compile(
            "(?i)gerad[ao]\\s+(?:às|as)\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4}(?:\\s+\\d{1,2}:\\d{2}:\\d{2})?)");

    private ProjudiManifestacaoTextoImportacaoParser() {}

    static List<PublicacaoWriteRequest> parseHtmlProjudi(
            String html, String assunto, String arquivoOrigemNome) {
        return parseHtmlProjudi(html, assunto, arquivoOrigemNome, null);
    }

    static List<PublicacaoWriteRequest> parseHtmlProjudi(
            String html, String assunto, String arquivoOrigemNome, String snippetGmail) {
        String corpoUnico = extrairCorpoEmailUnico(html);
        StringBuilder corpusSb = new StringBuilder();
        if (assunto != null && !assunto.isBlank()) {
            corpusSb.append(assunto.trim());
        }
        if (snippetGmail != null && !snippetGmail.isBlank()) {
            if (corpusSb.length() > 0) {
                corpusSb.append('\n');
            }
            corpusSb.append(snippetGmail.trim());
        }
        if (corpoUnico != null && !corpoUnico.isBlank()) {
            if (corpusSb.length() > 0) {
                corpusSb.append('\n');
            }
            corpusSb.append(corpoUnico);
        }
        String urls = extrairUrlsParaParsing(html);
        if (urls != null && !urls.isBlank()) {
            corpusSb.append('\n').append(urls);
        }
        return parseTextoBruto(corpusSb.toString(), assunto, arquivoOrigemNome, corpoUnico);
    }

    static List<PublicacaoWriteRequest> parseTextoBruto(String textoBruto, String assunto, String arquivoOrigemNome) {
        return parseTextoBruto(textoBruto, assunto, arquivoOrigemNome, null);
    }

    static List<PublicacaoWriteRequest> parseTextoBruto(
            String textoBruto, String assunto, String arquivoOrigemNome, String teorGravacao) {
        String limpo = normalizarTexto(textoBruto);
        String teorLimpo =
                teorGravacao != null && !teorGravacao.isBlank()
                        ? deduplicarParagrafosRepetidos(normalizarTexto(teorGravacao))
                        : null;
        List<String> blocos = segmentarBlocos(limpo);
        List<PublicacaoWriteRequest> out = new ArrayList<>();
        for (String bloco : blocos) {
            PublicacaoWriteRequest req = parseBloco(bloco, assunto, arquivoOrigemNome, teorLimpo);
            if (req != null) {
                out.add(req);
            }
        }
        if (out.isEmpty()) {
            Set<String> numeros = coletarNumerosProcessoEmTexto(assunto);
            numeros.addAll(coletarNumerosProcessoEmTexto(limpo));
            String teorFallback = teorLimpo != null ? teorLimpo : deduplicarParagrafosRepetidos(limpo);
            for (String numero : numeros) {
                PublicacaoWriteRequest req =
                        criarManifestacaoPorNumero(numero, assunto, arquivoOrigemNome, teorFallback);
                if (req != null) {
                    out.add(req);
                }
            }
        }
        List<PublicacaoWriteRequest> dedup = deduplicar(out);
        if (dedup.isEmpty() && ehAssuntoIntimacaoCitacao(assunto)) {
            log.warn(
                    "Parser Projudi: nenhum número de processo em email de intimação/citação (assunto={}, origem={})",
                    assunto,
                    arquivoOrigemNome);
        }
        log.info(
                "Parser Projudi origem={}: blocos={}, manifestacoes={}, assunto={}",
                arquivoOrigemNome,
                blocos.size(),
                dedup.size(),
                assunto);
        return dedup;
    }

    private static List<String> segmentarBlocos(String texto) {
        Matcher m = RE_INICIO_BLOCO.matcher(texto);
        List<Integer> starts = new ArrayList<>();
        while (m.find()) {
            starts.add(m.start());
        }
        if (starts.isEmpty()) {
            List<String> porCnj = segmentarPorOcorrenciasCnj(texto);
            if (!porCnj.isEmpty()) {
                return porCnj;
            }
            if (!coletarNumerosProcessoEmTexto(texto).isEmpty() && texto.length() > 40) {
                return List.of(texto.trim());
            }
            return List.of();
        }
        List<String> blocos = new ArrayList<>();
        for (int i = 0; i < starts.size(); i++) {
            int a = starts.get(i);
            int b = i + 1 < starts.size() ? starts.get(i + 1) : texto.length();
            String chunk = texto.substring(a, b).trim();
            if (chunk.length() > 20) {
                blocos.add(chunk);
            }
        }
        return blocos;
    }

    private static PublicacaoWriteRequest parseBloco(
            String bloco, String assunto, String arquivoOrigemNome, String teorGravacao) {
        String numero = extrairNumeroProcessoPrincipal(bloco);
        if (numero == null || numero.isBlank()) {
            return null;
        }

        String movimentacao = tipoFromAssunto(assunto);
        if (movimentacao.isBlank()) {
            movimentacao = extrairMovimentacao(bloco, assunto);
        }
        if (movimentacao.isBlank()) {
            movimentacao = classificarTipo(bloco, assunto);
        }

        String fonteData = teorGravacao != null && !teorGravacao.isBlank() ? teorGravacao : bloco;
        LocalDate data = extrairData(fonteData);
        if (data == null) {
            data = LocalDate.now();
        }

        String parteAutor = extrairParte(bloco, RE_PARTE_AUTOR);
        String parteReu = extrairParte(bloco, RE_PARTE_REU);
        String teor = teorGravacao != null && !teorGravacao.isBlank()
                ? teorGravacao
                : deduplicarParagrafosRepetidos(bloco.trim());
        String hashTeor = hashDedup(numero, movimentacao, teor);

        PublicacaoWriteRequest req = new PublicacaoWriteRequest();
        req.setNumeroProcessoEncontrado(numero);
        req.setDataPublicacao(data);
        req.setDataDisponibilizacao(data);
        req.setFonte("Projudi TJGO");
        req.setDiario("PROJUDI");
        req.setTitulo(trimAssunto(assunto));
        req.setTipoPublicacao(movimentacao);
        req.setResumo(gerarResumo(movimentacao, teor));
        req.setTeor(teor);
        req.setHashTeor(hashTeor);
        req.setHashConteudo(hashTeor);
        req.setOrigemImportacao("PROJUDI");
        req.setArquivoOrigemNome(arquivoOrigemNome);
        req.setStatusTratamento("PENDENTE");
        req.setLida(false);
        req.setObservacao("Importado automaticamente via Gmail (Projudi TJGO).");
        req.setJsonReferencia(jsonProjudi(movimentacao, parteAutor, parteReu, assunto, numero));
        return req;
    }

    private static String extrairNumeroProcessoPrincipal(String bloco) {
        Matcher ini = RE_INICIO_BLOCO.matcher(bloco);
        if (ini.find()) {
            String cnj = normalizarCnjCapturado(ini.group(1));
            if (cnj != null) {
                return cnj;
            }
        }
        Matcher m = CNJ.matcher(bloco);
        if (m.find()) {
            String cnj = formatarCnj(m);
            if (cnjEhPlausivel(cnj)) {
                return cnj;
            }
        }
        Matcher vinte = CNJ_20_DIGITOS.matcher(bloco);
        if (vinte.find()) {
            String cnj = cnjDe20Digitos(vinte.group(1));
            if (cnj != null && cnjEhPlausivel(cnj)) {
                return cnj;
            }
        }
        return extrairNumeroProjudiInterno(bloco);
    }

    private static String extrairNumeroProjudiInterno(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        Matcher m = RE_NUMERO_PROJUDI_INTERNO.matcher(texto);
        if (m.find()) {
            return m.group(1) + "." + m.group(2);
        }
        return null;
    }

    private static List<String> segmentarPorOcorrenciasCnj(String texto) {
        List<Integer> starts = new ArrayList<>();
        Matcher m = CNJ.matcher(texto);
        while (m.find()) {
            if (!starts.contains(m.start())) {
                starts.add(m.start());
            }
        }
        if (starts.isEmpty()) {
            Matcher vinte = CNJ_20_DIGITOS.matcher(texto);
            while (vinte.find()) {
                String cnj = cnjDe20Digitos(vinte.group(1));
                if (cnj != null) {
                    int idx = texto.indexOf(vinte.group(1), vinte.start());
                    if (idx >= 0 && !starts.contains(idx)) {
                        starts.add(idx);
                    }
                }
            }
        }
        if (starts.isEmpty()) {
            return List.of();
        }
        List<String> blocos = new ArrayList<>();
        for (int i = 0; i < starts.size(); i++) {
            int a = starts.get(i);
            int b = i + 1 < starts.size() ? starts.get(i + 1) : texto.length();
            int ctxInicio = Math.max(0, a - 120);
            String chunk = texto.substring(ctxInicio, b).trim();
            if (chunk.length() > 15) {
                blocos.add(chunk);
            }
        }
        return blocos;
    }

    /** Prioriza assunto padrão do Projudi TJGO para intimação/citação. */
    private static String tipoFromAssunto(String assunto) {
        String a = assunto == null ? "" : assunto.trim();
        if (a.isBlank()) {
            return "";
        }
        String lower = a.toLowerCase();
        if (lower.contains("processo arquivado") || (lower.contains("arquivad") && lower.contains("número"))) {
            return "Arquivamento";
        }
        if (lower.contains("[projudi]") && lower.contains("informa") && lower.contains("intima") && lower.contains("cita")) {
            return "Informação de intimação/citação";
        }
        if (lower.contains("informa") && lower.contains("intima") && lower.contains("cita")) {
            return "Informação de intimação/citação";
        }
        if (lower.contains("intima") && lower.contains("cita")) {
            return "Intimação/citação";
        }
        return "";
    }

    private static boolean ehAssuntoIntimacaoCitacao(String assunto) {
        return !tipoFromAssunto(assunto).isBlank() && tipoFromAssunto(assunto).toLowerCase().contains("intima");
    }

    private static PublicacaoWriteRequest criarManifestacaoPorNumero(
            String numero, String assunto, String arquivoOrigemNome, String teorBase) {
        if (numero == null || numero.isBlank()) {
            return null;
        }
        String movimentacao = tipoFromAssunto(assunto);
        if (movimentacao.isBlank()) {
            movimentacao = classificarTipo(teorBase, assunto);
        }
        String teor = teorBase != null && !teorBase.isBlank() ? teorBase.trim() : trimAssunto(assunto);
        String hashTeor = hashDedup(numero, movimentacao, teor);

        LocalDate data = extrairData(teorBase);
        if (data == null) {
            data = LocalDate.now();
        }

        PublicacaoWriteRequest req = new PublicacaoWriteRequest();
        req.setNumeroProcessoEncontrado(numero);
        req.setDataPublicacao(data);
        req.setDataDisponibilizacao(data);
        req.setFonte("Projudi TJGO");
        req.setDiario("PROJUDI");
        req.setTitulo(trimAssunto(assunto));
        req.setTipoPublicacao(movimentacao);
        req.setResumo(gerarResumo(movimentacao, teor));
        req.setTeor(teor);
        req.setHashTeor(hashTeor);
        req.setHashConteudo(hashTeor);
        req.setOrigemImportacao("PROJUDI");
        req.setArquivoOrigemNome(arquivoOrigemNome);
        req.setStatusTratamento("PENDENTE");
        req.setLida(false);
        req.setObservacao("Importado automaticamente via Gmail (Projudi TJGO).");
        req.setJsonReferencia(jsonProjudi(movimentacao, "", "", assunto, numero));
        return req;
    }

    private static Set<String> coletarNumerosProcessoEmTexto(String texto) {
        Set<String> out = new LinkedHashSet<>(coletarCnjsEmTexto(texto));
        Matcher m = RE_NUMERO_PROJUDI_INTERNO.matcher(String.valueOf(texto));
        while (m.find()) {
            out.add(m.group(1) + "." + m.group(2));
        }
        return out;
    }

    private static Set<String> coletarCnjsEmTexto(String texto) {
        if (texto == null || texto.isBlank()) {
            return Set.of();
        }
        Set<String> out = new LinkedHashSet<>();
        Matcher m = CNJ.matcher(texto);
        while (m.find()) {
            String cnj = formatarCnj(m);
            if (cnjEhPlausivel(cnj)) {
                out.add(cnj);
            }
        }
        Matcher vinte = CNJ_20_DIGITOS.matcher(texto);
        while (vinte.find()) {
            String cnj = cnjDe20Digitos(vinte.group(1));
            if (cnj != null && cnjEhPlausivel(cnj)) {
                out.add(cnj);
            }
        }
        Matcher url = RE_URL_PROCESSO_20.matcher(texto);
        while (url.find()) {
            String cnj = cnjDe20Digitos(url.group(1));
            if (cnj != null && cnjEhPlausivel(cnj)) {
                out.add(cnj);
            }
        }
        return out;
    }

    private static boolean cnjEhPlausivel(String cnj) {
        if (cnj == null || cnj.isBlank()) {
            return false;
        }
        Matcher m = CNJ.matcher(cnj.trim());
        if (!m.matches()) {
            return false;
        }
        try {
            int ano = Integer.parseInt(m.group(3));
            if (ano < 1996 || ano > 2035) {
                return false;
            }
            int seg = Integer.parseInt(m.group(4));
            return seg >= 1 && seg <= 9;
        } catch (Exception e) {
            return false;
        }
    }

    private static String minerarTextoVisivelDeHtml(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        String h = decodificarEntidadesHtml(html);
        h = h.replaceAll("(?i)<br\\s*/?>", "\n");
        h = h.replaceAll("(?i)</p>", "\n");
        h = h.replaceAll("(?i)</div>", "\n");
        h = h.replaceAll("(?i)</tr>", "\n");
        h = h.replaceAll("(?i)</t[dh]>", " ");
        h = h.replaceAll("<[^>]+>", " ");
        return h;
    }

    /**
     * Extrai um único corpo legível do email (evita duplicar text/plain + HTML convertido).
     */
    private static String extrairCorpoEmailUnico(String conteudoEmail) {
        if (conteudoEmail == null || conteudoEmail.isBlank()) {
            return "";
        }
        List<String> candidatos = new ArrayList<>();
        String[] partes = conteudoEmail.split("\n\n+");
        if (partes.length <= 1) {
            partes = new String[] {conteudoEmail};
        }
        for (String parte : partes) {
            String t = parte == null ? "" : parte.trim();
            if (t.length() < 20) {
                continue;
            }
            if (t.contains("<") && t.contains(">")) {
                t = PublicacaoTextoImportacaoParser.htmlParaTexto(decodificarEntidadesHtml(t));
            } else {
                t = decodificarEntidadesHtml(t);
            }
            t = deduplicarParagrafosRepetidos(normalizarTexto(t));
            if (t.length() > 20) {
                candidatos.add(t);
            }
        }
        if (candidatos.isEmpty()) {
            String t = PublicacaoTextoImportacaoParser.htmlParaTexto(decodificarEntidadesHtml(conteudoEmail));
            return deduplicarParagrafosRepetidos(normalizarTexto(t));
        }
        String melhor = "";
        for (String c : candidatos) {
            if (c.length() > melhor.length()) {
                melhor = c;
            }
        }
        return melhor;
    }

    /**
     * Remove conteúdo repetido (plain + HTML do mesmo email). Os emails do Projudi
     * repetem o mesmo bloco várias vezes com quebras simples (\n) e duplas (\n\n)
     * misturadas, então deduplicamos no nível de LINHA mantendo a ordem da primeira
     * aparição.
     */
    private static String deduplicarParagrafosRepetidos(String texto) {
        if (texto == null || texto.isBlank()) {
            return "";
        }
        String[] linhas = texto.split("\n");
        List<String> unicos = new ArrayList<>();
        List<String> normVistos = new ArrayList<>();
        for (String raw : linhas) {
            String t = raw.trim();
            if (t.isBlank()) {
                if (!unicos.isEmpty() && !unicos.get(unicos.size() - 1).isEmpty()) {
                    unicos.add("");
                }
                continue;
            }
            String norm = normalizarParaComparacao(t);
            if (norm.length() < 12) {
                unicos.add(t);
                continue;
            }
            boolean repetido = false;
            for (String normU : normVistos) {
                if (norm.equals(normU) || normU.contains(norm) || norm.contains(normU)) {
                    repetido = true;
                    break;
                }
            }
            if (!repetido) {
                normVistos.add(norm);
                unicos.add(t);
            }
        }
        while (!unicos.isEmpty() && unicos.get(unicos.size() - 1).isEmpty()) {
            unicos.remove(unicos.size() - 1);
        }
        if (unicos.isEmpty()) {
            return texto.trim();
        }
        return String.join("\n", unicos);
    }

    private static String normalizarParaComparacao(String s) {
        return decodificarEntidadesHtml(String.valueOf(s))
                .replaceAll("\\s+", " ")
                .toLowerCase()
                .replaceAll("[^a-z0-9áàâãéèêíìîóòôõúùûç\\.]", "");
    }

    private static String decodificarEntidadesHtml(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        String h = html;
        h = h.replace("&#45;", "-").replace("&#46;", ".").replace("&nbsp;", " ");
        h = h.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">");
        h = h.replace("&quot;", "\"").replace("&#39;", "'");
        h = h.replace("&aacute;", "á").replace("&Aacute;", "Á");
        h = h.replace("&eacute;", "é").replace("&Eacute;", "É");
        h = h.replace("&iacute;", "í").replace("&Iacute;", "Í");
        h = h.replace("&oacute;", "ó").replace("&Oacute;", "Ó");
        h = h.replace("&uacute;", "ú").replace("&Uacute;", "Ú");
        h = h.replace("&atilde;", "ã").replace("&Atilde;", "Ã");
        h = h.replace("&otilde;", "õ").replace("&Otilde;", "Õ");
        h = h.replace("&ccedil;", "ç").replace("&Ccedil;", "Ç");
        h = h.replace("&ordm;", "º").replace("&ordf;", "ª");
        h = h.replace("&agrave;", "à");
        Matcher num = Pattern.compile("&#(\\d+);").matcher(h);
        StringBuilder sb = new StringBuilder();
        while (num.find()) {
            try {
                int cp = Integer.parseInt(num.group(1));
                if (cp > 0 && cp < 0x10FFFF) {
                    num.appendReplacement(sb, Matcher.quoteReplacement(String.valueOf((char) cp)));
                }
            } catch (NumberFormatException ignored) {
                // mantém entidade original
            }
        }
        num.appendTail(sb);
        return sb.toString();
    }

    /** Só para localizar CNJ em links — não entra no teor gravado. */
    private static String extrairUrlsParaParsing(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        Matcher href = Pattern.compile("(?i)href=[\"']([^\"']+)[\"']").matcher(html);
        while (href.find()) {
            sb.append(href.group(1)).append('\n');
        }
        return sb.toString();
    }

    private static String extrairTextoUtilDeHtmlBruto(String html) {
        String h = decodificarEntidadesHtml(html);
        h = h.replaceAll("(?i)<br\\s*/?>", "\n");
        h = h.replaceAll("(?i)</tr>", "\n");
        h = h.replaceAll("(?i)</t[dh]>", " ");
        StringBuilder sb = new StringBuilder();
        Matcher href = Pattern.compile("(?i)href=[\"']([^\"']+)[\"']").matcher(h);
        while (href.find()) {
            sb.append(' ').append(href.group(1)).append('\n');
        }
        Matcher title = Pattern.compile("(?i)title=[\"']([^\"']+)[\"']").matcher(h);
        while (title.find()) {
            sb.append(' ').append(title.group(1)).append('\n');
        }
        Matcher value = Pattern.compile("(?i)value=[\"']([^\"']+)[\"']").matcher(h);
        while (value.find()) {
            sb.append(' ').append(value.group(1)).append('\n');
        }
        sb.append('\n').append(PublicacaoTextoImportacaoParser.htmlParaTexto(h));
        sb.append('\n').append(minerarTextoVisivelDeHtml(h));
        return sb.toString();
    }

    private static String cnjDe20Digitos(String digitos) {
        if (digitos == null || digitos.length() != 20) {
            return null;
        }
        String fmt = String.format(
                "%s-%s.%s.%s.%s.%s",
                digitos.substring(0, 7),
                digitos.substring(7, 9),
                digitos.substring(9, 13),
                digitos.substring(13, 14),
                digitos.substring(14, 16),
                digitos.substring(16, 20));
        Matcher m = CNJ.matcher(fmt);
        if (m.find()) {
            return formatarCnj(m);
        }
        return null;
    }

    private static String extrairMovimentacao(String bloco, String assunto) {
        Matcher mm = RE_MOVIMENTACAO.matcher(bloco);
        if (mm.find()) {
            return limparRotulo(mm.group(1));
        }
        return classificarTipo(bloco, assunto);
    }

    private static String classificarTipo(String bloco, String assunto) {
        String tipoAssunto = tipoFromAssunto(assunto);
        if (!tipoAssunto.isBlank()) {
            return tipoAssunto;
        }
        String t = (String.valueOf(assunto) + "\n" + bloco).toLowerCase();
        if (t.contains("informa") && t.contains("intima") && t.contains("cita")) {
            return "Informação de intimação/citação";
        }
        if (t.contains("intima") && t.contains("cita")) {
            return "Intimação/citação";
        }
        if (t.contains("intima")) return "Intimação";
        if (t.contains("cita")) return "Citação";
        if (t.contains("arquiv")) return "Arquivamento";
        if (t.contains("senten")) return "Sentença";
        if (t.contains("despacho")) return "Despacho";
        if (t.contains("decis")) return "Decisão";
        if (t.contains("audi")) return "Audiência";
        if (t.contains("julg")) return "Julgamento";
        if (t.contains("peti")) return "Peticionamento";
        return "Movimentação Projudi";
    }

    private static LocalDate extrairData(String bloco) {
        Matcher mg = RE_DATA_GERADA_EMAIL.matcher(bloco);
        if (mg.find()) {
            Matcher dm = Pattern.compile("(\\d{1,2})/(\\d{1,2})/(\\d{2,4})").matcher(mg.group(1));
            if (dm.find()) {
                return parseDataBr(dm.group(1), dm.group(2), dm.group(3));
            }
        }
        Matcher md = RE_DATA_MOV.matcher(bloco);
        if (md.find()) {
            Matcher dm = Pattern.compile("(\\d{1,2})/(\\d{1,2})/(\\d{2,4})").matcher(md.group(1));
            if (dm.find()) {
                return parseDataBr(dm.group(1), dm.group(2), dm.group(3));
            }
        }
        Matcher m = Pattern.compile("\\b(\\d{1,2})/(\\d{1,2})/(\\d{2,4})\\b").matcher(bloco);
        if (m.find()) {
            return parseDataBr(m.group(1), m.group(2), m.group(3));
        }
        return null;
    }

    private static String extrairParte(String bloco, Pattern rotulo) {
        Matcher m = rotulo.matcher(bloco);
        if (m.find()) {
            return limparRotulo(m.group(1));
        }
        return "";
    }

    private static String jsonProjudi(
            String tipoMovimento, String parteAutor, String parteReu, String assunto, String numeroProcesso) {
        String formato = ehNumeroProjudiInterno(numeroProcesso) ? "PROJUDI_INTERNO" : "CNJ";
        return "{\"projudi\":{"
                + "\"tipoMovimento\":\""
                + escapeJson(tipoMovimento)
                + "\",\"parteAutor\":\""
                + escapeJson(parteAutor)
                + "\",\"parteReu\":\""
                + escapeJson(parteReu)
                + "\",\"assuntoEmail\":\""
                + escapeJson(trimAssunto(assunto))
                + "\",\"formatoNumero\":\""
                + formato
                + "\",\"numeroProjudiInterno\":\""
                + escapeJson(ehNumeroProjudiInterno(numeroProcesso) ? numeroProcesso : "")
                + "\"}}";
    }

    private static boolean ehNumeroProjudiInterno(String numero) {
        return numero != null && numero.matches("\\d{4,9}\\.\\d{2}");
    }

    private static String escapeJson(String s) {
        return String.valueOf(s == null ? "" : s)
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }

    private static String trimAssunto(String assunto) {
        String a = assunto == null ? "" : assunto.trim();
        return a.length() > 300 ? a.substring(0, 300) : a;
    }

    private static String limparRotulo(String s) {
        String t = String.valueOf(s == null ? "" : s).replaceAll("\\s+", " ").trim();
        if (t.length() > 240) {
            t = t.substring(0, 237) + "...";
        }
        return t;
    }

    private static String gerarResumo(String movimentacao, String teor) {
        String base = movimentacao + " — " + teor.replaceAll("\\s+", " ").trim();
        if (base.length() <= 240) {
            return base;
        }
        return base.substring(0, 237) + "...";
    }

    private static List<PublicacaoWriteRequest> deduplicar(List<PublicacaoWriteRequest> itens) {
        Map<String, PublicacaoWriteRequest> vistos = new LinkedHashMap<>();
        for (PublicacaoWriteRequest item : itens) {
            String cnj = item.getNumeroProcessoEncontrado() == null
                    ? ""
                    : item.getNumeroProcessoEncontrado().trim().toUpperCase();
            if (cnj.isBlank()) {
                continue;
            }
            String tipo = item.getTipoPublicacao() == null ? "" : item.getTipoPublicacao().trim();
            String origem = item.getArquivoOrigemNome() == null ? "" : item.getArquivoOrigemNome().trim();
            String key = cnj + "|" + tipo + "|" + origem;
            PublicacaoWriteRequest anterior = vistos.get(key);
            if (anterior == null || tamanhoTeor(item) > tamanhoTeor(anterior)) {
                vistos.put(key, item);
            }
        }
        return new ArrayList<>(vistos.values());
    }

    private static int tamanhoTeor(PublicacaoWriteRequest item) {
        return item.getTeor() == null ? 0 : item.getTeor().length();
    }

    private static String normalizarCnjCapturado(String bruto) {
        Matcher m = CNJ.matcher(String.valueOf(bruto));
        if (!m.find()) {
            return null;
        }
        return formatarCnj(m);
    }

    private static String formatarCnj(Matcher m) {
        return String.format(
                        "%s-%s.%s.%s.%s.%s",
                        m.group(1), m.group(2), m.group(3), m.group(4), m.group(5), m.group(6))
                .toUpperCase();
    }

    private static String normalizarTexto(String texto) {
        String t = String.valueOf(texto == null ? "" : texto);
        t = t.replace("\r\n", "\n").replace('\r', '\n');
        t = t.replace('\u00AD', ' ').replace("\u200B", "").replace("\uFEFF", "");
        t = t.replace('–', '-').replace('—', '-');
        t = t.replaceAll(" +", " ");
        t = t.replaceAll("\n{3,}", "\n\n");
        return removerRuidoProjudi(t).trim();
    }

    private static String removerRuidoProjudi(String texto) {
        String[] linhas = texto.split("\n", -1);
        StringBuilder sb = new StringBuilder();
        for (String raw : linhas) {
            String l = raw.trim();
            if (l.isEmpty()) {
                sb.append('\n');
                continue;
            }
            if (l.equalsIgnoreCase("gmail")) continue;
            if (l.toLowerCase().startsWith("mostrar mensagem original")) continue;
            String ll = l.toLowerCase();
            if (ll.contains("tjgo.jus.br")
                    && l.length() < 80
                    && !ll.contains("processo")
                    && !ll.contains("intima")
                    && !ll.contains("cita")
                    && !CNJ.matcher(l).find()
                    && !CNJ_20_DIGITOS.matcher(l).find()) {
                continue;
            }
            sb.append(raw).append('\n');
        }
        return sb.toString();
    }

    private static LocalDate parseDataBr(String dd, String mm, String yy) {
        try {
            int dia = Integer.parseInt(dd);
            int mes = Integer.parseInt(mm);
            int ano = Integer.parseInt(yy);
            if (yy.length() == 2) {
                ano = ano <= 69 ? 2000 + ano : 1900 + ano;
            }
            return LocalDate.of(ano, mes, dia);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Chave de deduplicação estável: número do processo + tipo de movimento + teor já
     * normalizado/decodificado. NÃO inclui o messageId nem o nome do arquivo de origem, para
     * que o mesmo evento (mesmo email reprocessado, ou cópias do Projudi com messageIds distintos)
     * gere o mesmo hash e seja deduplicado.
     */
    private static String hashDedup(String numero, String movimentacao, String teor) {
        String n = String.valueOf(numero == null ? "" : numero.trim());
        String m = String.valueOf(movimentacao == null ? "" : movimentacao.trim());
        String t = normalizarParaComparacao(String.valueOf(teor == null ? "" : teor));
        return sha256Hex(n + "|" + m + "|" + t);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(String.valueOf(input == null ? "" : input).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
