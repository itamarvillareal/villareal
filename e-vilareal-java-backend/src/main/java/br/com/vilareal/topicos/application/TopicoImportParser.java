package br.com.vilareal.topicos.application;

import org.springframework.util.StringUtils;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parseia nomes e conteúdos de arquivos .txt legados (Dropbox «Banco de Dados/Tópicos»).
 */
final class TopicoImportParser {

    static final String SEPARADOR_BLOCO = "8*&*@&#(*@&93837942";
    private static final Charset WINDOWS_1252 = Charset.forName("Windows-1252");
    private static final Pattern TAG_FORMATACAO = Pattern.compile("\\(\"([^\"]+)\"\\)", Pattern.CASE_INSENSITIVE);

    private TopicoImportParser() {}

    record MetadadosArquivo(String categoria, String subcategoria, String nome, String chaveNavegacao) {}

    record BlocoImportado(int blocoIndice, String conteudo, String tipoFormatacao) {}

    static MetadadosArquivo parseMetadados(String nomeArquivo) {
        String stem = nomeArquivo != null ? nomeArquivo.trim() : "";
        if (stem.toLowerCase(Locale.ROOT).endsWith(".txt")) {
            stem = stem.substring(0, stem.length() - 4);
        }
        String[] partes = stem.split("=");
        List<String> segmentos = new ArrayList<>();
        for (String p : partes) {
            String n = normalizarLabel(p);
            if (StringUtils.hasText(n)) {
                segmentos.add(n);
            }
        }
        if (segmentos.size() < 2) {
            throw new IllegalArgumentException("Nome de arquivo inválido (mínimo 2 segmentos): " + nomeArquivo);
        }
        String categoria = truncar(segmentos.get(0), 200);
        String nome = truncar(segmentos.get(segmentos.size() - 1), 300);
        String subcategoria = null;
        if (segmentos.size() > 2) {
            subcategoria = truncar(String.join(" › ", segmentos.subList(1, segmentos.size() - 1)), 200);
        }
        return new MetadadosArquivo(categoria, subcategoria, nome, truncar(stem, 500));
    }

    static String decodificarConteudo(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return "";
        }
        String utf8 = new String(bytes, StandardCharsets.UTF_8);
        if (pareceMojibake(utf8) || !utf8Valido(bytes)) {
            return new String(bytes, WINDOWS_1252);
        }
        return utf8;
    }

    static List<BlocoImportado> parseBlocos(String conteudoBruto) {
        String conteudo = conteudoBruto != null ? conteudoBruto.replace("\r\n", "\n").replace('\r', '\n') : "";
        if (!StringUtils.hasText(conteudo.trim())) {
            return List.of();
        }
        String[] partes = conteudo.split(Pattern.quote(SEPARADOR_BLOCO));
        List<BlocoImportado> out = new ArrayList<>();
        int idx = 0;
        for (String parte : partes) {
            String bloco = parte.trim();
            if (!StringUtils.hasText(bloco)) {
                continue;
            }
            out.add(new BlocoImportado(idx, bloco, detectarTipoFormatacao(bloco)));
            idx++;
        }
        if (out.isEmpty()) {
            out.add(new BlocoImportado(0, conteudo.trim(), detectarTipoFormatacao(conteudo)));
        }
        return out;
    }

    static String detectarTipoFormatacao(String bloco) {
        if (!StringUtils.hasText(bloco)) {
            return null;
        }
        Matcher m = TAG_FORMATACAO.matcher(bloco);
        if (!m.find()) {
            return null;
        }
        String tag = m.group(1).replace('\n', ' ').replace('\r', ' ').trim().toUpperCase(Locale.ROOT);
        tag = tag.replaceAll("\\s+", " ");
        if (tag.contains("TÍTULO") && tag.contains("CLAUSULA")
                || tag.contains("TITULO") && tag.contains("CLAUSULA")
                || tag.contains("TÍTULO") && tag.contains("CLÁUSULA")
                || tag.contains("TITULO") && tag.contains("CLÁUSULA")) {
            return "TITULO_CLAUSULA";
        }
        if (tag.contains("CABECALHO") || tag.contains("CABEÇALHO")) {
            return "CABECALHO";
        }
        if (tag.contains("CLAUSULA") || tag.contains("CLÁUSULA")) {
            return "CLAUSULA";
        }
        if (tag.contains("TITULO") || tag.contains("TÍTULO")) {
            return "TITULO";
        }
        return null;
    }

    private static boolean utf8Valido(byte[] bytes) {
        try {
            StandardCharsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                    .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
                    .decode(java.nio.ByteBuffer.wrap(bytes));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean pareceMojibake(String s) {
        return s.contains("Ã") || s.contains("â€") || s.contains("Ã©") || s.contains("Ã£");
    }

    private static String normalizarLabel(String s) {
        return Normalizer.normalize(s != null ? s.trim() : "", Normalizer.Form.NFC);
    }

    private static String truncar(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
