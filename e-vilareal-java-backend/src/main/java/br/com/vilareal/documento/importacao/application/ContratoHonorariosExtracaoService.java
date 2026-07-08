package br.com.vilareal.documento.importacao.application;

import br.com.vilareal.documento.ClaudeApiService;
import br.com.vilareal.documento.ContratoHonorariosParcelaClausula3;
import br.com.vilareal.documento.OcrService;
import br.com.vilareal.documento.PdfTextoExtracaoUtil;
import br.com.vilareal.documento.importacao.api.dto.ContratoHonorariosExtracaoDados;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ContratoHonorariosExtracaoService {

    private static final Pattern CLAUSULA_REMUNERACAO = Pattern.compile(
            "(?is)(cl[aá]usula\\s*(?:3|terceira|3ª|3a)[^\\n]{0,80}remunera[^\\n]*\\n)(.+?)(?=cl[aá]usula\\s*(?:4|quarta)|$)");
    private static final Pattern CNJ = Pattern.compile(
            "\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}");

    private final ClaudeApiService claudeApi;
    private final OcrService ocrService;
    private final ObjectMapper objectMapper;

    public ContratoHonorariosExtracaoService(
            ClaudeApiService claudeApi, OcrService ocrService, ObjectMapper objectMapper) {
        this.claudeApi = claudeApi;
        this.ocrService = ocrService;
        this.objectMapper = objectMapper;
    }

    public record ResultadoExtracao(
            String textoCompleto,
            String clausulaExtraida,
            ContratoHonorariosExtracaoDados dados,
            BigDecimal scoreConfianca,
            List<String> alertas) {}

    public ResultadoExtracao extrair(byte[] pdfBytes, String nomeArquivo) {
        List<String> alertas = new ArrayList<>();
        byte[] pdf = pdfBytes;
        String texto = PdfTextoExtracaoUtil.extrairTexto(pdf);
        if (PdfTextoExtracaoUtil.precisaOcr(texto, ocrService.getMinCaracteres())) {
            try {
                OcrService.ResultadoOcr ocr = ocrService.processarPdfSeNecessario(pdf);
                pdf = ocr.pdfPesquisavel();
                texto = ocr.textoExtraido();
                if (ocr.ocrAplicado()) {
                    alertas.add("PDF escaneado — OCR aplicado.");
                }
            } catch (Exception ex) {
                alertas.add("OCR indisponível: " + ex.getMessage());
            }
        }
        if (!StringUtils.hasText(texto)) {
            alertas.add("Não foi possível extrair texto do PDF.");
            return new ResultadoExtracao("", "", null, BigDecimal.ZERO, alertas);
        }
        String clausula = extrairClausulaRemuneracao(texto);
        if (!StringUtils.hasText(clausula)) {
            clausula = texto.length() > 4000 ? texto.substring(0, 4000) : texto;
            alertas.add("Cláusula de remuneração não localizada — usando trecho amplo.");
        }
        ContratoHonorariosExtracaoDados dados = extrairComIa(clausula, texto, alertas);
        BigDecimal score = calcularScore(dados, alertas);
        return new ResultadoExtracao(texto, clausula, dados, score, alertas);
    }

    static String extrairClausulaRemuneracao(String texto) {
        if (!StringUtils.hasText(texto)) {
            return "";
        }
        Matcher m = CLAUSULA_REMUNERACAO.matcher(texto);
        if (m.find()) {
            return (m.group(1) + m.group(2)).trim();
        }
        int idx = texto.toLowerCase(Locale.ROOT).indexOf("remunera");
        if (idx >= 0) {
            int fim = Math.min(texto.length(), idx + 2500);
            return texto.substring(Math.max(0, idx - 200), fim).trim();
        }
        return "";
    }

    private ContratoHonorariosExtracaoDados extrairComIa(
            String clausula, String textoCompleto, List<String> alertas) {
        try {
            String system = """
                    Você extrai dados estruturados de contratos de honorários advocatícios brasileiros.
                    Responda EXCLUSIVAMENTE em JSON válido, sem markdown.
                    Estrutura:
                    {
                      "tipoRemuneracao": "PERCENTUAL_PROVEITO" | "VALOR_FIXO" | "MISTO",
                      "percentualProveito": number ou null,
                      "valorFixo": number ou null,
                      "temParcelamento": boolean,
                      "gerarRecebiveis": boolean,
                      "quantidadeParcelas": integer ou null,
                      "valorTotalParcelas": number ou null,
                      "primeiroVencimento": "YYYY-MM-DD" ou null,
                      "intervaloParcelas": "MENSAL" | "UNICA",
                      "formaPagamento": "PIX" | "BOLETO" ou null,
                      "dataContrato": "YYYY-MM-DD" ou null,
                      "objetoContrato": string ou null,
                      "formaAssinatura": "duas_vias" ou "via_digital",
                      "numeroCnjExtraido": string ou null,
                      "partesExtraidas": string ou null,
                      "valorCausaExtraido": number ou null,
                      "temCasoVinculado": boolean
                    }
                    temCasoVinculado=true quando há processo/CNJ/caso específico; false para mensalidade geral sem caso.
                    """;
            String user = "Cláusula de remuneração:\n" + clausula + "\n\nTrecho adicional:\n"
                    + (textoCompleto.length() > 6000 ? textoCompleto.substring(0, 6000) : textoCompleto);
            String resposta = claudeApi.enviarMensagem(system, user, 2048, 0.1);
            return parsearJson(resposta, textoCompleto);
        } catch (Exception ex) {
            alertas.add("Falha na extração IA: " + ex.getMessage());
            return heuristicaFallback(clausula, textoCompleto);
        }
    }

    private ContratoHonorariosExtracaoDados parsearJson(String json, String textoCompleto) throws Exception {
        String limpo = json.trim();
        if (limpo.startsWith("```")) {
            limpo = limpo.replaceAll("(?s)^```json?\\s*", "").replaceAll("```\\s*$", "").trim();
        }
        JsonNode root = objectMapper.readTree(limpo);
        String cnj = textOrNull(root, "numeroCnjExtraido");
        if (!StringUtils.hasText(cnj)) {
            cnj = extrairCnj(textoCompleto);
        }
        boolean temCaso = root.path("temCasoVinculado").asBoolean(StringUtils.hasText(cnj));
        return new ContratoHonorariosExtracaoDados(
                textOrNull(root, "tipoRemuneracao"),
                decimalOrNull(root, "percentualProveito"),
                decimalOrNull(root, "valorFixo"),
                boolOrDefault(root, "temParcelamento", true),
                boolOrDefault(root, "gerarRecebiveis", true),
                intOrNull(root, "quantidadeParcelas"),
                decimalOrNull(root, "valorTotalParcelas"),
                dateOrNull(root, "primeiroVencimento"),
                textOrNull(root, "intervaloParcelas"),
                textOrNull(root, "formaPagamento"),
                List.of(),
                dateOrNull(root, "dataContrato"),
                textOrNull(root, "objetoContrato"),
                textOrNull(root, "formaAssinatura"),
                cnj,
                textOrNull(root, "partesExtraidas"),
                decimalOrNull(root, "valorCausaExtraido"),
                temCaso);
    }

    private static ContratoHonorariosExtracaoDados heuristicaFallback(String clausula, String texto) {
        String cnj = extrairCnj(texto);
        BigDecimal pct = null;
        Matcher pm = Pattern.compile("(\\d{1,3})\\s*%").matcher(clausula);
        if (pm.find()) {
            pct = new BigDecimal(pm.group(1));
        }
        BigDecimal valor = null;
        Matcher vm = Pattern.compile("R\\$\\s*([\\d.,]+)").matcher(clausula);
        if (vm.find()) {
            valor = parseBrDecimal(vm.group(1));
        }
        String tipo = "PERCENTUAL_PROVEITO";
        if (valor != null && pct != null) {
            tipo = "MISTO";
        } else if (valor != null) {
            tipo = "VALOR_FIXO";
        }
        return new ContratoHonorariosExtracaoDados(
                tipo,
                pct,
                valor,
                valor != null,
                valor != null,
                null,
                valor,
                null,
                "MENSAL",
                "PIX",
                List.of(),
                null,
                null,
                "duas_vias",
                cnj,
                null,
                null,
                StringUtils.hasText(cnj));
    }

    static String extrairCnj(String texto) {
        if (!StringUtils.hasText(texto)) {
            return null;
        }
        Matcher m = CNJ.matcher(texto);
        return m.find() ? m.group() : null;
    }

    static BigDecimal calcularScore(ContratoHonorariosExtracaoDados dados, List<String> alertas) {
        if (dados == null) {
            return BigDecimal.ZERO;
        }
        int pts = 40;
        if (StringUtils.hasText(dados.tipoRemuneracao())) {
            pts += 20;
        }
        if (dados.percentualProveito() != null || dados.valorFixo() != null) {
            pts += 20;
        }
        if (dados.dataContrato() != null) {
            pts += 10;
        }
        if (alertas.stream().anyMatch(a -> a.contains("Falha") || a.contains("Não foi possível"))) {
            pts -= 30;
        }
        return BigDecimal.valueOf(Math.max(0, Math.min(100, pts)));
    }

    private static String textOrNull(JsonNode n, String field) {
        JsonNode v = n.path(field);
        if (v.isMissingNode() || v.isNull()) {
            return null;
        }
        String s = v.asText(null);
        return StringUtils.hasText(s) ? s.trim() : null;
    }

    private static BigDecimal decimalOrNull(JsonNode n, String field) {
        JsonNode v = n.path(field);
        if (v.isMissingNode() || v.isNull()) {
            return null;
        }
        if (v.isNumber()) {
            return v.decimalValue();
        }
        return parseBrDecimal(v.asText());
    }

    private static Integer intOrNull(JsonNode n, String field) {
        JsonNode v = n.path(field);
        if (v.isMissingNode() || v.isNull()) {
            return null;
        }
        return v.asInt(0) > 0 ? v.asInt() : null;
    }

    private static boolean boolOrDefault(JsonNode n, String field, boolean def) {
        JsonNode v = n.path(field);
        return v.isMissingNode() || v.isNull() ? def : v.asBoolean(def);
    }

    private static LocalDate dateOrNull(JsonNode n, String field) {
        String s = textOrNull(n, field);
        if (!StringUtils.hasText(s)) {
            return null;
        }
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            try {
                return LocalDate.parse(s, DateTimeFormatter.ofPattern("dd/MM/yyyy"));
            } catch (DateTimeParseException e2) {
                return null;
            }
        }
    }

    private static BigDecimal parseBrDecimal(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String s = raw.replace("R$", "").trim().replace(".", "").replace(",", ".");
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
