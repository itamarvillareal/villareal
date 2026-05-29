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

    private static final Pattern RE_INICIO_BLOCO = Pattern.compile(
            "(?is)(?:^|\\n)\\s*(?:Processo|N[uú]mero\\s+do\\s+[Pp]rocesso)\\s*[:.]?\\s*(?:\\n\\s*|\\s+)"
                    + "(\\d{7}\\s*[-–]\\s*\\d{2}\\s*\\.\\s*\\d{4}\\s*\\.\\s*\\d\\s*\\.\\s*\\d{2}\\s*\\.\\s*\\d{4})");

    private static final Pattern RE_MOVIMENTACAO = Pattern.compile(
            "(?is)(?:Movimenta[çc][aã]o|Tipo\\s+de\\s+[Mm]ovimenta[çc][aã]o|Evento)\\s*[:.]?\\s*([^\\n]{3,240})");

    private static final Pattern RE_DATA_MOV = Pattern.compile(
            "(?is)(?:Data(?:\\s+da\\s+movimenta[çc][aã]o)?|Data/Hora)\\s*[:.]?\\s*(\\d{1,2}/\\d{1,2}/\\d{2,4}(?:\\s+\\d{1,2}:\\d{2})?)");

    private static final Pattern RE_PARTE_AUTOR = Pattern.compile(
            "(?im)^\\s*(?:Autor(?:a)?|Requerente|Parte\\s+[Aa]utora|Polo\\s+[Aa]tivo)\\s*[:.]?\\s*(.+)$");

    private static final Pattern RE_PARTE_REU = Pattern.compile(
            "(?im)^\\s*(?:R[eé]u|Requerid[oa]|Parte\\s+[Rr][eé]|Polo\\s+[Pp]assivo)\\s*[:.]?\\s*(.+)$");

    private ProjudiManifestacaoTextoImportacaoParser() {}

    static List<PublicacaoWriteRequest> parseHtmlProjudi(String html, String assunto, String arquivoOrigemNome) {
        return parseTextoBruto(PublicacaoTextoImportacaoParser.htmlParaTexto(html), assunto, arquivoOrigemNome);
    }

    static List<PublicacaoWriteRequest> parseTextoBruto(String textoBruto, String assunto, String arquivoOrigemNome) {
        String limpo = normalizarTexto(textoBruto);
        if (limpo.isBlank()) {
            return List.of();
        }
        List<String> blocos = segmentarBlocos(limpo);
        List<PublicacaoWriteRequest> out = new ArrayList<>();
        for (String bloco : blocos) {
            PublicacaoWriteRequest req = parseBloco(bloco, assunto, arquivoOrigemNome);
            if (req != null) {
                out.add(req);
            }
        }
        List<PublicacaoWriteRequest> dedup = deduplicar(out);
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
            Matcher cnj = CNJ.matcher(texto);
            if (cnj.find()) {
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

    private static PublicacaoWriteRequest parseBloco(String bloco, String assunto, String arquivoOrigemNome) {
        String numero = extrairCnjPrincipal(bloco);
        if (numero == null || numero.isBlank()) {
            return null;
        }

        String movimentacao = extrairMovimentacao(bloco, assunto);
        if (movimentacao.isBlank()) {
            movimentacao = classificarTipo(bloco, assunto);
        }

        LocalDate data = extrairData(bloco);
        if (data == null) {
            data = LocalDate.now();
        }

        String parteAutor = extrairParte(bloco, RE_PARTE_AUTOR);
        String parteReu = extrairParte(bloco, RE_PARTE_REU);
        String teor = bloco.trim();
        String hashTeor = sha256Hex(teor + "|" + movimentacao);

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
        req.setJsonReferencia(jsonProjudi(movimentacao, parteAutor, parteReu, assunto));
        return req;
    }

    private static String extrairCnjPrincipal(String bloco) {
        Matcher ini = RE_INICIO_BLOCO.matcher(bloco);
        if (ini.find()) {
            return normalizarCnjCapturado(ini.group(1));
        }
        Matcher m = CNJ.matcher(bloco);
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
        String t = (String.valueOf(assunto) + "\n" + bloco).toLowerCase();
        if (t.contains("arquiv")) return "Arquivamento";
        if (t.contains("intima")) return "Intimação";
        if (t.contains("cita")) return "Citação";
        if (t.contains("senten")) return "Sentença";
        if (t.contains("despacho")) return "Despacho";
        if (t.contains("decis")) return "Decisão";
        if (t.contains("audi")) return "Audiência";
        if (t.contains("julg")) return "Julgamento";
        if (t.contains("peti")) return "Peticionamento";
        return "Movimentação Projudi";
    }

    private static LocalDate extrairData(String bloco) {
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

    private static String jsonProjudi(String tipoMovimento, String parteAutor, String parteReu, String assunto) {
        return "{\"projudi\":{"
                + "\"tipoMovimento\":\""
                + escapeJson(tipoMovimento)
                + "\",\"parteAutor\":\""
                + escapeJson(parteAutor)
                + "\",\"parteReu\":\""
                + escapeJson(parteReu)
                + "\",\"assuntoEmail\":\""
                + escapeJson(trimAssunto(assunto))
                + "\"}}";
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
            if (l.toLowerCase().contains("tjgo.jus.br") && l.length() < 80 && !l.contains("Processo")) continue;
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
