package br.com.vilareal.email;

import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parser textual alinhado ao fluxo do frontend ({@code publicacoesPdfParser.js}):
 * normalização → segmentação por CNJ → campos de {@link PublicacaoWriteRequest}.
 */
final class PublicacaoTextoImportacaoParser {

    private static final Pattern CNJ =
            Pattern.compile(
                    "\\b(\\d{7})\\s*[-–]\\s*(\\d{2})\\s*\\.\\s*(\\d{4})\\s*\\.\\s*(\\d)\\s*\\.\\s*(\\d{2})\\s*\\.\\s*(\\d{4})\\b",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern DATA_BR = Pattern.compile("\\b(\\d{1,2})/(\\d{1,2})/(\\d{2,4})\\b");

    private PublicacaoTextoImportacaoParser() {}

    static List<PublicacaoWriteRequest> parseHtmlJusbrasil(String html, String arquivoOrigemNome) {
        return parseTextoBruto(htmlParaTexto(html), arquivoOrigemNome);
    }

    static List<PublicacaoWriteRequest> parseTextoBruto(String textoBruto, String arquivoOrigemNome) {
        String limpo = normalizarTexto(textoBruto);
        if (limpo.isBlank()) {
            return List.of();
        }
        List<String> blocos = segmentarPorCnj(limpo);
        if (blocos.isEmpty()) {
            blocos = List.of(limpo);
        }
        List<PublicacaoWriteRequest> out = new ArrayList<>();
        for (String bloco : blocos) {
            PublicacaoWriteRequest req = parseBloco(bloco, arquivoOrigemNome);
            if (req != null) {
                out.add(req);
            }
        }
        return deduplicar(out);
    }

    private static PublicacaoWriteRequest parseBloco(String bloco, String arquivoOrigemNome) {
        Matcher cnj = CNJ.matcher(bloco);
        if (!cnj.find()) {
            return null;
        }
        String numeroCnj = String.format(
                        "%s-%s.%s.%s.%s.%s",
                        cnj.group(1), cnj.group(2), cnj.group(3), cnj.group(4), cnj.group(5), cnj.group(6))
                .toUpperCase();

        LocalDate dataPub = null;
        LocalDate dataDisp = null;
        Matcher dm = DATA_BR.matcher(bloco);
        List<LocalDate> datas = new ArrayList<>();
        while (dm.find()) {
            LocalDate d = parseDataBr(dm.group(1), dm.group(2), dm.group(3));
            if (d != null) {
                datas.add(d);
            }
        }
        if (datas.size() >= 2) {
            dataDisp = datas.get(0);
            dataPub = datas.get(1);
        } else if (datas.size() == 1) {
            dataPub = datas.get(0);
        }

        String teor = bloco.trim();
        String hashTeor = sha256Hex(teor);

        PublicacaoWriteRequest req = new PublicacaoWriteRequest();
        req.setNumeroProcessoEncontrado(numeroCnj);
        req.setDataPublicacao(dataPub);
        req.setDataDisponibilizacao(dataDisp);
        req.setFonte("Jusbrasil");
        req.setDiario(extrairDiario(bloco));
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
        return req;
    }

    private static String extrairDiario(String bloco) {
        Matcher m = Pattern.compile("(?i)\\bDi[áa]rio[^\\n]{0,120}").matcher(bloco);
        if (m.find()) {
            return m.group().trim();
        }
        return null;
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

    private static List<String> segmentarPorCnj(String texto) {
        Matcher m = CNJ.matcher(texto);
        List<Integer> indices = new ArrayList<>();
        while (m.find()) {
            indices.add(m.start());
        }
        if (indices.isEmpty()) {
            return List.of();
        }
        List<String> blocos = new ArrayList<>();
        for (int i = 0; i < indices.size(); i++) {
            int start = Math.max(0, indices.get(i) - 400);
            int end = i + 1 < indices.size() ? indices.get(i + 1) : texto.length();
            String chunk = texto.substring(start, end).trim();
            if (chunk.length() > 15) {
                blocos.add(chunk);
            }
        }
        return blocos;
    }

    private static List<PublicacaoWriteRequest> deduplicar(List<PublicacaoWriteRequest> itens) {
        Map<String, PublicacaoWriteRequest> vistos = new LinkedHashMap<>();
        for (PublicacaoWriteRequest item : itens) {
            String key = item.getNumeroProcessoEncontrado() + "|" + item.getHashConteudo();
            vistos.putIfAbsent(key, item);
        }
        return new ArrayList<>(vistos.values());
    }

    static String htmlParaTexto(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        String t = html;
        t = t.replaceAll("(?i)<br\\s*/?>", "\n");
        t = t.replaceAll("(?i)</p>", "\n");
        t = t.replaceAll("(?i)</div>", "\n");
        t = t.replaceAll("<[^>]+>", " ");
        t = t.replace("&nbsp;", " ");
        t = t.replace("&amp;", "&");
        t = t.replace("&lt;", "<");
        t = t.replace("&gt;", ">");
        t = t.replace("&quot;", "\"");
        return normalizarTexto(t);
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
