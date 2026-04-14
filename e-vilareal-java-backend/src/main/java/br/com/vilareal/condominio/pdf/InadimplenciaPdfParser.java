package br.com.vilareal.condominio.pdf;

import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaResumoDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaUnidadeDto;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extrai unidades e cobranças de relatório PDF «Inadimplência por Unidade» (gestora condominial).
 */
public final class InadimplenciaPdfParser {

    private static final Logger log = LoggerFactory.getLogger(InadimplenciaPdfParser.class);

    /** Padrão estrito (linha inteira), 4 dígitos — diagnóstico. */
    private static final Pattern PAT_UNIDADE_ESTRITO_MULTILINHA =
            Pattern.compile("^([A-Z]+-\\d{4})$", Pattern.MULTILINE);

    /** Linha só com torre+apto: A-0103, A-103, hífen ASCII ou tipográfico. */
    private static final Pattern PAT_UNIDADE_LINHA_INTEIRA = Pattern.compile(
            "^\\s*([A-Za-zÀ-ÿ]+)[-–—](\\d{3,4})\\s*$", Pattern.CASE_INSENSITIVE);

    /** Índice de linha + código (coluna numérica do PDF). */
    private static final Pattern PAT_UNIDADE_COM_INDICE = Pattern.compile(
            "^\\s*\\d+\\s+([A-Za-zÀ-ÿ]+)[-–—](\\d{3,4})\\s*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAT_DATA_REF =
            Pattern.compile("Data de referência:\\s*(\\d{2}/\\d{2}/\\d{4})", Pattern.CASE_INSENSITIVE);

    /** Primeira linha tipo «Residencial X Inadimplência por Unidade». */
    private static final Pattern PAT_TITULO_COM_INADIMPLENCIA = Pattern.compile(
            "^(.+?)\\s+Inadimplência\\s+por\\s+Unidade\\s*$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    /**
     * Sufixo típico: período (mm/aaaa) + vencimento + valor (+ demais colunas monetárias). Relatórios completos trazem
     * Multa, Juros, Atual., Hon., Vl.Atual. após o valor principal. Valores podem usar ponto ou espaço como milhar.
     */
    private static final String PAT_MILHARES_VALOR = "\\d{1,3}(?:[.\\s]\\d{3})*,\\d{2}";

    private static final Pattern PAT_VALOR_BR = Pattern.compile(PAT_MILHARES_VALOR);

    /** Captura período, vencimento, coluna Valor e, opcionalmente, mais montantes até o fim da linha. */
    private static final Pattern PAT_COBRANCA_SUFFIX = Pattern.compile(
            "\\s+(\\d{2}/\\d{4})\\s+(\\d{2}/\\d{2}/\\d{4})\\s+("
                    + PAT_MILHARES_VALOR
                    + ")((?:\\s+"
                    + PAT_MILHARES_VALOR
                    + ")*)\\s*$");

    /**
     * Linhas de encargo calculado pela administradora (multa/juros/correção/honorários de cobrança) não entram na
     * importação — o sistema recalcula. Comparação no texto da receita (antes do nº do doc), sem acentos e em minúsculas.
     */
    private static final String[] PREFIXOS_RECEITA_ENCARGO_ADMIN_IGNORAR = {
        "multa,",
        "juros,",
        "atualizacao monetaria,",
        "honorario administrativo,",
        "honorarios administrativo,",
        "correcao monetaria",
        "correcao monetaria,",
    };

    private InadimplenciaPdfParser() {}

    public static InadimplenciaPdfParseResult parse(byte[] pdfBytes) throws IOException {
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            String textoCompleto = stripper.getText(doc);
            diagnosticarTextoBruto(textoCompleto);
            return parseText(textoCompleto);
        }
    }

    /**
     * Diagnóstico temporário: texto bruto e tentativa de achar unidades com o padrão estrito.
     * Em produção, prefira nível DEBUG ou remova após estabilizar o layout do PDF.
     */
    private static void diagnosticarTextoBruto(String textoCompleto) {
        if (textoCompleto == null || !log.isDebugEnabled()) {
            return;
        }
        int lim = Math.min(3000, textoCompleto.length());
        log.debug(
                "=== TEXTO BRUTO PDF (primeiros {} de {} chars) ===\n{}",
                lim,
                textoCompleto.length(),
                textoCompleto.substring(0, lim));
        Matcher m = PAT_UNIDADE_ESTRITO_MULTILINHA.matcher(textoCompleto);
        int count = 0;
        while (m.find() && count < 10) {
            log.debug("Unidade (padrão estrito AAAA-NNNN): '{}'", m.group(1));
            count++;
        }
        if (count == 0) {
            log.debug("Nenhuma unidade encontrada com o padrão estrito ^[A-Z]+-\\d{4}$ (multilinha).");
        }
    }

    /** Expuesto para testes e inspeção sem gravar log. */
    public static String extrairTextoBruto(byte[] pdfBytes) throws IOException {
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(doc);
        }
    }

    /** Expuesto para testes com texto já extraído. */
    public static InadimplenciaPdfParseResult parseText(String text) {
        String condominioNome = "";
        String dataRef = "";
        Matcher mRef = PAT_DATA_REF.matcher(text);
        if (mRef.find()) {
            dataRef = mRef.group(1);
        }
        String[] rawLines = text.split("\\R");
        List<String> lines = new ArrayList<>();
        for (String raw : rawLines) {
            String t = normalizarEspacosEColagens(raw);
            if (!t.isEmpty()) {
                lines.add(t);
            }
        }
        lines = juntarUnidadePartidaEmDuasLinhas(lines);
        for (String line : lines) {
            Matcher mt = PAT_TITULO_COM_INADIMPLENCIA.matcher(line);
            if (mt.matches()) {
                condominioNome = mt.group(1).trim();
                break;
            }
        }
        if (condominioNome.isEmpty()) {
            for (String line : lines) {
                if (isLinhaIgnorada(line)) {
                    continue;
                }
                if (extrairCodigoUnidadeDaLinha(line).isPresent()) {
                    break;
                }
                if (PAT_DATA_REF.matcher(line).find()) {
                    continue;
                }
                if (line.contains("Inadimplência")
                        || line.contains("Anápolis")
                        || line.contains("GO")) {
                    continue;
                }
                condominioNome = line;
                break;
            }
        }

        Map<String, List<InadimplenciaCobrancaDto>> porUnidade = new LinkedHashMap<>();
        String unidadeAtual = null;

        for (String line : lines) {
            if (isLinhaIgnorada(line)) {
                continue;
            }
            Optional<String> codUnidade = extrairCodigoUnidadeDaLinha(line);
            if (codUnidade.isPresent()) {
                unidadeAtual = codUnidade.get();
                porUnidade.putIfAbsent(unidadeAtual, new ArrayList<>());
                continue;
            }
            if (unidadeAtual == null) {
                continue;
            }
            if (isCabecalhoColunas(line)) {
                continue;
            }
            if (line.startsWith("TOTAL de")) {
                continue;
            }
            Optional<InadimplenciaCobrancaDto> cob = parseLinhaCobranca(line);
            final String uKey = unidadeAtual;
            cob.ifPresent(c -> porUnidade.get(uKey).add(c));
        }

        List<InadimplenciaUnidadeDto> unidades = new ArrayList<>();
        long totalCentavos = 0;
        int qCob = 0;
        for (Map.Entry<String, List<InadimplenciaCobrancaDto>> e : porUnidade.entrySet()) {
            if (e.getValue().isEmpty()) {
                continue;
            }
            unidades.add(new InadimplenciaUnidadeDto(e.getKey(), List.copyOf(e.getValue())));
            for (InadimplenciaCobrancaDto c : e.getValue()) {
                qCob++;
                totalCentavos += c.valorCentavos();
            }
        }

        InadimplenciaResumoDto resumo =
                new InadimplenciaResumoDto(unidades.size(), qCob, totalCentavos);
        return new InadimplenciaPdfParseResult(condominioNome, dataRef, unidades, resumo);
    }

    private static boolean isLinhaIgnorada(String line) {
        String u = line.toUpperCase(Locale.ROOT);
        if (u.contains("ALTO NIVEL GESTAO CONDOMINIAL")) {
            return true;
        }
        if (line.startsWith("-- ") && line.contains(" of ")) {
            return true;
        }
        if (line.contains("Inadimplência por Unidade Pág")) {
            return true;
        }
        if (line.startsWith("Vencimento: sempre até")) {
            return true;
        }
        if (u.equals("INADIMPLÊNCIA POR UNIDADE") || u.equals("INADIMPLÊNCIA POR UNIDADE PÁG. 1 DE 45")) {
            return true;
        }
        return false;
    }

    private static boolean isCabecalhoColunas(String line) {
        String n = normalizarAsciiHeader(line);
        return n.contains("DOC N.NUM")
                || n.contains("DOC N.")
                || (n.contains("PERIODO") && n.contains("VENCIMENTO") && n.contains("VALOR"))
                || (n.contains("PERÍODO") && n.contains("VENCIMENTO") && n.contains("VALOR"));
    }

    private static String normalizarAsciiHeader(String line) {
        if (line == null) {
            return "";
        }
        return java.text.Normalizer.normalize(line, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toUpperCase(Locale.ROOT);
    }

    private static String normalizarEspacosEColagens(String raw) {
        if (raw == null) {
            return "";
        }
        String t = raw.replace('\u00A0', ' ').replace('–', '-').replace('—', '-').trim();
        return t.replaceAll("\\s+", " ");
    }

    /**
     * PDFs costumam partir "A-" e "0103" em linhas consecutivas.
     */
    private static List<String> juntarUnidadePartidaEmDuasLinhas(List<String> lines) {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            String a = lines.get(i);
            if (i + 1 < lines.size()) {
                String b = lines.get(i + 1);
                if (a.matches("(?i)^[A-Za-zÀ-ÿ]+-$") && b.matches("^\\d{3,4}$")) {
                    out.add(a + b);
                    i++;
                    continue;
                }
            }
            out.add(a);
        }
        return out;
    }

    /** Torre + número com 3 ou 4 dígitos, normalizado para 4 dígitos (ex.: A-103 → A-0103). */
    static Optional<String> extrairCodigoUnidadeDaLinha(String line) {
        String n = normalizarEspacosEColagens(line);
        if (n.isEmpty()) {
            return Optional.empty();
        }
        Matcher m = PAT_UNIDADE_LINHA_INTEIRA.matcher(n);
        if (m.matches()) {
            return Optional.of(formatarCodigoUnidade(m.group(1), m.group(2)));
        }
        m = PAT_UNIDADE_COM_INDICE.matcher(n);
        if (m.matches()) {
            return Optional.of(formatarCodigoUnidade(m.group(1), m.group(2)));
        }
        return Optional.empty();
    }

    private static String formatarCodigoUnidade(String torre, String digitos) {
        String t = torre.toUpperCase(Locale.ROOT).trim();
        int v = Integer.parseInt(digitos, 10);
        return t + "-" + String.format("%04d", v);
    }

    private static Optional<InadimplenciaCobrancaDto> parseLinhaCobranca(String line) {
        Matcher ms = PAT_COBRANCA_SUFFIX.matcher(line);
        if (!ms.find()) {
            return Optional.empty();
        }
        String beforeP = line.substring(0, ms.start()).trim();
        if (beforeP.isEmpty()) {
            return Optional.empty();
        }
        String periodo = ms.group(1);
        String vencimento = ms.group(2);
        String valorStr = ms.group(3);
        String multa = "0,00";
        String restanteMontantes = ms.group(4);
        if (restanteMontantes != null && !restanteMontantes.isBlank()) {
            Matcher mm = PAT_VALOR_BR.matcher(restanteMontantes);
            if (mm.find()) {
                multa = mm.group(0);
            }
        }

        String[] tokens = beforeP.split("\\s+");
        if (tokens.length == 0) {
            return Optional.empty();
        }
        int j = tokens.length - 1;
        while (j >= 0 && tokens[j].matches("\\d+") && tokens[j].length() >= 5) {
            j--;
        }
        if (j < 0 || !tokens[j].matches("\\d+")) {
            return Optional.empty();
        }
        String doc = tokens[j];
        StringBuilder receitaSb = new StringBuilder();
        for (int k = 0; k < j; k++) {
            if (k > 0) {
                receitaSb.append(' ');
            }
            receitaSb.append(tokens[k]);
        }
        String receita = receitaSb.toString().trim().replaceAll("[\\s,;]+$", "");
        if (receita.isEmpty()) {
            return Optional.empty();
        }
        if (isReceitaEncargoAdministradoraNaoImportavel(receita)) {
            return Optional.empty();
        }

        long centavos = parseValorBrCentavos(valorStr);
        return Optional.of(new InadimplenciaCobrancaDto(
                receita, doc, periodo, vencimento, valorStr, centavos, multa));
    }

    static boolean isReceitaEncargoAdministradoraNaoImportavel(String receita) {
        if (receita == null || receita.isBlank()) {
            return false;
        }
        String norm = normalizarReceitaParaPrefixo(receita);
        for (String p : PREFIXOS_RECEITA_ENCARGO_ADMIN_IGNORAR) {
            if (norm.startsWith(p)) {
                return true;
            }
        }
        return false;
    }

    private static String normalizarReceitaParaPrefixo(String s) {
        String n = Normalizer.normalize(s.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return n.toLowerCase(Locale.ROOT);
    }

    static long parseValorBrCentavos(String br) {
        if (br == null || br.isBlank()) {
            return 0;
        }
        String t = br.trim().replace(".", "").replace(" ", "").replace(',', '.');
        try {
            return BigDecimal.valueOf(Double.parseDouble(t))
                    .movePointRight(2)
                    .setScale(0, java.math.RoundingMode.HALF_UP)
                    .longValue();
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    public record InadimplenciaPdfParseResult(
            String condominioNome,
            String dataReferenciaPdf,
            List<InadimplenciaUnidadeDto> unidades,
            InadimplenciaResumoDto resumo) {}
}
