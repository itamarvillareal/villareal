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
import java.util.stream.Collectors;

/**
 * Parser de emails Jusbrasil: segmenta blocos estruturados (Processo → CNJ → Termos encontrados → … → Publicação).
 * CNJs citados apenas no teor não geram novas publicações.
 */
public final class PublicacaoTextoImportacaoParser {

    private static final Logger log = LoggerFactory.getLogger(PublicacaoTextoImportacaoParser.class);

    private static final String CNJ_CORE =
            "(\\d{7}\\s*[-–]\\s*\\d{2}\\s*\\.\\s*\\d{4}\\s*\\.\\s*\\d\\s*\\.\\s*\\d{2}\\s*\\.\\s*\\d{4})";

    private static final Pattern CNJ =
            Pattern.compile(
                    "\\b(\\d{7})\\s*[-–]\\s*(\\d{2})\\s*\\.\\s*(\\d{4})\\s*\\.\\s*(\\d)\\s*\\.\\s*(\\d{2})\\s*\\.\\s*(\\d{4})\\b",
                    Pattern.CASE_INSENSITIVE);

    /**
     * Início de bloco Jusbrasil: «Processo» + CNJ + «Termos encontrados» (cabeçalho estruturado).
     * Evita segmentar citações do tipo «Processo 6047814-…» dentro do teor.
     */
    private static final Pattern RE_INICIO_BLOCO_JUSBRASIL = Pattern.compile(
            "(?is)(?:^|\\n)\\s*Processo\\s*(?::)?\\s*(?:\\n\\s*|\\s+)"
                    + CNJ_CORE
                    + "\\s*(?:\\n\\s*|\\s+)Termos\\s+encontrados");

    /** Cabeçalho estruturado no topo do bloco (CNJ principal). */
    private static final Pattern RE_CABECALHO_BLOCO = Pattern.compile(
            "(?is)^\\s*Processo\\s*(?::)?\\s*(?:\\n\\s*|\\s+)" + CNJ_CORE + "\\s*(?:\\n\\s*|\\s+)Termos\\s+encontrados");

    private static final Pattern RE_PUBLICACAO = Pattern.compile("(?i)(?:^|\\n)\\s*Publica[çc][aã]o\\s*[:.]?\\s*");

    private static final Pattern RE_INLINE_DISP =
            Pattern.compile("(?i)Data\\s+de\\s+disponibiliza[çc][aã]o\\s*[:.]?\\s*(\\d{1,2}/\\d{1,2}/\\d{2,4})");
    private static final Pattern RE_INLINE_PUB =
            Pattern.compile("(?i)Data\\s+de\\s+publica[çc][aã]o\\s*[:.]?\\s*(\\d{1,2}/\\d{1,2}/\\d{2,4})");
    private static final Pattern RE_ROTULO_DISP = Pattern.compile("(?i)Data\\s+de\\s+disponibiliza[çc][aã]o");
    private static final Pattern RE_ROTULO_PUB = Pattern.compile("(?i)Data\\s+de\\s+publica[çc][aã]o");
    private static final Pattern RE_DIARIO = Pattern.compile("(?i)\\bDi[áa]rio\\s*[:.]?\\s*([^\\n]+)");
    private static final Pattern RE_TERMOS =
            Pattern.compile("(?i)Termos\\s+encontrados\\s*[:.]?\\s*([^\\n]+)");

    private PublicacaoTextoImportacaoParser() {}

    static List<PublicacaoWriteRequest> parseHtmlJusbrasil(String html, String arquivoOrigemNome) {
        return parseTextoBruto(htmlParaTexto(html), arquivoOrigemNome);
    }

    static List<PublicacaoWriteRequest> parseTextoBruto(String textoBruto, String arquivoOrigemNome) {
        String limpo = normalizarTexto(textoBruto);
        if (limpo.isBlank()) {
            return List.of();
        }
        List<String> blocos = segmentarBlocosPublicacaoJusbrasil(limpo);
        List<PublicacaoWriteRequest> out = new ArrayList<>();
        int blocosIgnorados = 0;
        for (String bloco : blocos) {
            PublicacaoWriteRequest req = parseBlocoPublicacao(bloco, arquivoOrigemNome);
            if (req != null) {
                out.add(req);
            } else {
                blocosIgnorados++;
            }
        }
        List<PublicacaoWriteRequest> dedup = deduplicarPorBloco(out);
        logDiagnosticoParse(arquivoOrigemNome, blocos.size(), blocosIgnorados, dedup);
        return dedup;
    }

    private static void logDiagnosticoParse(
            String arquivoOrigemNome, int blocosSegmentados, int blocosIgnorados, List<PublicacaoWriteRequest> itens) {
        Set<String> principais = itens.stream()
                .map(PublicacaoWriteRequest::getNumeroProcessoEncontrado)
                .filter(n -> n != null && !n.isBlank())
                .map(String::trim)
                .map(String::toUpperCase)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> citados = new LinkedHashSet<>();
        for (PublicacaoWriteRequest item : itens) {
            citados.addAll(extrairCitadosDoJson(item.getJsonReferencia()));
        }
        log.info(
                "Parser Jusbrasil origem={}: blocosSegmentados={}, blocosIgnorados={}, publicacoes={}, processosUnicos={}, principais={}, citadosNoTeor={}",
                arquivoOrigemNome,
                blocosSegmentados,
                blocosIgnorados,
                itens.size(),
                principais.size(),
                principais,
                citados);
    }

    private static Set<String> extrairCitadosDoJson(String json) {
        if (json == null || json.isBlank()) {
            return Set.of();
        }
        Set<String> out = new LinkedHashSet<>();
        Matcher m = CNJ.matcher(json);
        while (m.find()) {
            out.add(formatarCnj(m));
        }
        return out;
    }

    private static List<String> segmentarBlocosPublicacaoJusbrasil(String texto) {
        Matcher m = RE_INICIO_BLOCO_JUSBRASIL.matcher(texto);
        List<Integer> starts = new ArrayList<>();
        while (m.find()) {
            starts.add(m.start());
        }
        if (starts.isEmpty()) {
            return List.of();
        }
        List<String> blocos = new ArrayList<>();
        for (int i = 0; i < starts.size(); i++) {
            int a = starts.get(i);
            int b = i + 1 < starts.size() ? starts.get(i + 1) : texto.length();
            String chunk = texto.substring(a, b).trim();
            if (chunk.length() > 30) {
                blocos.add(chunk);
            }
        }
        return blocos;
    }

    private static PublicacaoWriteRequest parseBlocoPublicacao(String bloco, String arquivoOrigemNome) {
        if (!isBlocoPublicacaoEstruturada(bloco)) {
            return null;
        }

        String numeroPrincipal = extrairNumeroProcessoPrincipal(bloco);
        if (numeroPrincipal == null || numeroPrincipal.isBlank()) {
            return null;
        }

        String metadados = parteMetadados(bloco);
        LocalDate dataDisp = extrairDataRotulo(metadados, RE_INLINE_DISP, RE_ROTULO_DISP);
        LocalDate dataPub = extrairDataRotulo(metadados, RE_INLINE_PUB, RE_ROTULO_PUB);
        if (dataPub == null) {
            return null;
        }

        String teor = extrairTeorPublicacao(bloco);
        if (teor.isBlank()) {
            return null;
        }

        List<String> citadosNoTeor = extrairProcessosCitadosNoTeor(teor, numeroPrincipal);
        String hashTeor = sha256Hex(teor);

        PublicacaoWriteRequest req = new PublicacaoWriteRequest();
        req.setNumeroProcessoEncontrado(numeroPrincipal);
        req.setDataPublicacao(dataPub);
        req.setDataDisponibilizacao(dataDisp);
        req.setFonte("Jusbrasil");
        req.setDiario(extrairDiario(metadados));
        req.setTitulo(extrairTermosEncontrados(metadados));
        req.setTipoPublicacao(classificarTipo(teor));
        req.setResumo(gerarResumo(teor));
        req.setTeor(teor);
        req.setHashTeor(hashTeor);
        req.setHashConteudo(hashTeor);
        req.setOrigemImportacao("MONITORAMENTO");
        req.setArquivoOrigemNome(arquivoOrigemNome);
        req.setStatusTratamento("PENDENTE");
        req.setLida(false);
        req.setObservacao("Importado automaticamente via Gmail (Jusbrasil).");
        if (!citadosNoTeor.isEmpty()) {
            req.setJsonReferencia(jsonProcessosCitadosNoTeor(citadosNoTeor));
        }
        return req;
    }

    /** Bloco válido: cabeçalho Jusbrasil + data de publicação rotulada + teor após «Publicação». */
    private static boolean isBlocoPublicacaoEstruturada(String bloco) {
        if (!RE_CABECALHO_BLOCO.matcher(bloco).find()) {
            return false;
        }
        String metadados = parteMetadados(bloco);
        if (!RE_TERMOS.matcher(metadados).find()) {
            return false;
        }
        if (!RE_ROTULO_PUB.matcher(metadados).find() && !RE_INLINE_PUB.matcher(metadados).find()) {
            return false;
        }
        return RE_PUBLICACAO.matcher(bloco).find();
    }

    private static String extrairNumeroProcessoPrincipal(String bloco) {
        Matcher cab = RE_CABECALHO_BLOCO.matcher(bloco);
        if (cab.find()) {
            return normalizarCnjCapturado(cab.group(1));
        }
        return null;
    }

    private static String normalizarCnjCapturado(String bruto) {
        Matcher m = CNJ.matcher(String.valueOf(bruto));
        if (!m.find()) {
            return null;
        }
        return formatarCnj(m);
    }

    private static String parteMetadados(String bloco) {
        Matcher m = RE_PUBLICACAO.matcher(bloco);
        if (m.find()) {
            return bloco.substring(0, m.start());
        }
        return bloco;
    }

    private static String extrairTeorPublicacao(String bloco) {
        Matcher m = RE_PUBLICACAO.matcher(bloco);
        if (!m.find()) {
            return "";
        }
        String teor = bloco.substring(m.end()).trim();
        return teor.replaceAll("(?m)^\\s*:\\s*", "").replaceAll("\n{3,}", "\n\n").trim();
    }

    private static LocalDate extrairDataRotulo(String metadados, Pattern inline, Pattern rotulo) {
        Matcher mi = inline.matcher(metadados);
        if (mi.find()) {
            LocalDate d = parseDataBrString(mi.group(1));
            if (d != null) {
                return d;
            }
        }
        Matcher mr = rotulo.matcher(metadados);
        if (mr.find()) {
            String resto = metadados.substring(mr.end(), Math.min(metadados.length(), mr.end() + 800));
            for (String linha : resto.split("\n")) {
                Matcher dm = Pattern.compile("\\b(\\d{1,2})/(\\d{1,2})/(\\d{2,4})\\b").matcher(linha.trim());
                if (dm.find()) {
                    LocalDate d = parseDataBr(dm.group(1), dm.group(2), dm.group(3));
                    if (d != null) {
                        return d;
                    }
                }
            }
        }
        return null;
    }

    private static LocalDate parseDataBrString(String s) {
        Matcher m = Pattern.compile("(\\d{1,2})/(\\d{1,2})/(\\d{2,4})").matcher(String.valueOf(s).trim());
        if (!m.find()) {
            return null;
        }
        return parseDataBr(m.group(1), m.group(2), m.group(3));
    }

    private static String extrairDiario(String metadados) {
        Matcher m = RE_DIARIO.matcher(metadados);
        if (m.find()) {
            return m.group(1).trim();
        }
        return null;
    }

    private static String extrairTermosEncontrados(String metadados) {
        Matcher m = RE_TERMOS.matcher(metadados);
        if (m.find()) {
            String t = m.group(1).trim();
            return t.length() > 500 ? t.substring(0, 500) : t;
        }
        return null;
    }

    private static List<String> extrairProcessosCitadosNoTeor(String teor, String numeroPrincipal) {
        if (teor == null || teor.isBlank()) {
            return List.of();
        }
        String principal = numeroPrincipal == null ? "" : numeroPrincipal.trim().toUpperCase();
        Set<String> out = new LinkedHashSet<>();
        Matcher m = CNJ.matcher(teor);
        while (m.find()) {
            String cnj = formatarCnj(m);
            if (!cnj.equalsIgnoreCase(principal)) {
                out.add(cnj);
            }
        }
        return new ArrayList<>(out);
    }

    private static String jsonProcessosCitadosNoTeor(List<String> processos) {
        StringBuilder sb = new StringBuilder("{\"processosCitadosNoTeor\":[");
        for (int i = 0; i < processos.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append('"').append(escapeJson(processos.get(i))).append('"');
        }
        sb.append("]}");
        return sb.toString();
    }

    private static String escapeJson(String s) {
        return String.valueOf(s)
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }

    private static List<PublicacaoWriteRequest> deduplicarPorBloco(List<PublicacaoWriteRequest> itens) {
        Map<String, PublicacaoWriteRequest> vistos = new LinkedHashMap<>();
        for (PublicacaoWriteRequest item : itens) {
            String cnj = item.getNumeroProcessoEncontrado() == null
                    ? ""
                    : item.getNumeroProcessoEncontrado().trim().toUpperCase();
            if (cnj.isBlank()) {
                continue;
            }
            String data = item.getDataPublicacao() != null ? item.getDataPublicacao().toString() : "";
            String hash = item.getHashTeor() != null ? item.getHashTeor() : "";
            String key = cnj + "|" + data + "|" + hash;
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

    private static String formatarCnj(Matcher m) {
        return String.format(
                        "%s-%s.%s.%s.%s.%s",
                        m.group(1), m.group(2), m.group(3), m.group(4), m.group(5), m.group(6))
                .toUpperCase();
    }

    private static String classificarTipo(String teor) {
        String t = teor.toLowerCase();
        if (t.contains("intima")) return "Intimação";
        if (t.contains("despacho")) return "Despacho";
        if (t.contains("senten")) return "Sentença";
        if (t.contains("decis")) return "Decisão";
        return "Publicação";
    }

    private static String gerarResumo(String teor) {
        String limpo = teor.replaceAll("\\s+", " ").trim();
        if (limpo.length() <= 240) {
            return limpo;
        }
        return limpo.substring(0, 237) + "...";
    }

    public static String htmlParaTexto(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        String t = html;
        t = t.replaceAll("(?is)<style[^>]*>.*?</style>", "\n");
        t = t.replaceAll("(?is)<script[^>]*>.*?</script>", "\n");
        t = t.replaceAll("(?i)<br\\s*/?>", "\n");
        t = t.replaceAll("(?i)</p>", "\n");
        t = t.replaceAll("(?i)</div>", "\n");
        t = t.replaceAll("<[^>]+>", " ");
        t = t.replace("&nbsp;", " ");
        t = t.replace("&amp;", "&");
        t = t.replace("&lt;", "<");
        t = t.replace("&gt;", ">");
        t = t.replace("&quot;", "\"");
        t = removerCssSoltoDoTexto(t);
        return normalizarTexto(t);
    }

    /** Remove blocos CSS órfãos (ex.: conteúdo de {@code <style>} após remoção das tags). */
    public static String removerCssSoltoDoTexto(String texto) {
        if (texto == null || texto.isBlank()) {
            return "";
        }
        String[] linhas = texto.split("\n", -1);
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < linhas.length) {
            if (blocoCssComecaEm(linhas, i)) {
                i = pularBlocoCss(linhas, i);
                continue;
            }
            String linha = linhas[i];
            if (linhaPareceCssIsolada(linha)) {
                i++;
                continue;
            }
            sb.append(linha);
            if (i < linhas.length - 1) {
                sb.append('\n');
            }
            i++;
        }
        return sb.toString();
    }

    private static boolean blocoCssComecaEm(String[] linhas, int idx) {
        if (idx >= linhas.length) {
            return false;
        }
        String t = linhas[idx].trim();
        if (t.matches("(?i)^[.#@*a-z0-9_-]+\\s*\\{\\s*$")) {
            return true;
        }
        if (t.matches("(?i)^[.#@*a-z0-9_,\\s-]+\\{.*")) {
            return t.contains("{");
        }
        return false;
    }

    private static int pularBlocoCss(String[] linhas, int start) {
        int depth = 0;
        for (int i = start; i < linhas.length; i++) {
            String linha = linhas[i];
            for (int j = 0; j < linha.length(); j++) {
                char c = linha.charAt(j);
                if (c == '{') {
                    depth++;
                } else if (c == '}') {
                    depth--;
                }
            }
            if (depth <= 0 && linha.contains("}")) {
                return i + 1;
            }
        }
        return linhas.length;
    }

    private static boolean linhaPareceCssIsolada(String linha) {
        String t = linha == null ? "" : linha.trim();
        if (t.isEmpty()) {
            return false;
        }
        if (t.matches("^[{}]$")) {
            return true;
        }
        if (t.matches("(?i)^\\}\\s*$")) {
            return true;
        }
        if (t.matches("(?i)^[.#@*a-z0-9_-]+\\s*\\{\\s*$")) {
            return true;
        }
        if (t.matches("(?i)^[a-z-]+\\s*:\\s*[^;{]+;\\s*$")) {
            return true;
        }
        return false;
    }

    private static String normalizarTexto(String texto) {
        String t = String.valueOf(texto == null ? "" : texto);
        t = t.replace("\r\n", "\n").replace('\r', '\n');
        t = t.replace('\u00AD', ' ').replace("\u200B", "").replace("\uFEFF", "");
        t = t.replace('–', '-').replace('—', '-');
        t = t.replaceAll(" +", " ");
        t = t.replaceAll("\n{3,}", "\n\n");
        t = removerRuidoEmail(t);
        return t.trim();
    }

    private static String removerRuidoEmail(String texto) {
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
            if (l.toLowerCase().startsWith("on ") && l.toLowerCase().endsWith("wrote:")) continue;
            if (l.toLowerCase().contains("jusbrasil.com.br") && l.length() < 120) continue;
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
