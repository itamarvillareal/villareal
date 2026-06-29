package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.CalculoApplicationService;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parser do relatório de inadimplência condominial exportado em .xls (OOXML).
 * Cabeçalhos de coluna são detectados por rótulo literal em cada bloco de unidade.
 */
@Component
public class CobrancaRelatorioXlsParser {

    private static final Pattern PAT_PROPRIETARIO =
            Pattern.compile("Proprietário:\\s*(.*?)\\s*\\(([\\d./-]+)\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAT_SUBTOTAL =
            Pattern.compile("^.+:\\s*\\d+\\s+cobrança", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern PAT_DATA_REFERENCIA =
            Pattern.compile("Data de referência:\\s*(.+)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    /** Col0 isolado: {@code A0402}, {@code 000-A}, {@code 1201R*} ou {@code ADM}. */
    private static final Pattern PAT_CODIGO_UNIDADE_COL0 = Pattern.compile(
            "^(?:ADM|[ABRV]\\d{3,4}\\*?|\\d{3,4}-[ABRV]\\*?|\\d{3,4}[ABRV]\\*?)$", Pattern.CASE_INSENSITIVE);

    private static final String HDR_TIPO = "tipo";
    private static final String HDR_DOC = "doc";
    private static final String HDR_PERIODO = "periodo";
    private static final String HDR_VENCIMENTO = "vencimento";
    private static final String HDR_VALOR = "valor";
    private static final String HDR_MULTA = "multa";

    private final DataFormatter formatter = new DataFormatter(Locale.forLanguageTag("pt-BR"));

    public CobrancaRelatorioParseResult parseRelatorio(InputStream xls) throws IOException {
        try (Workbook wb = WorkbookFactory.create(xls)) {
            if (wb.getNumberOfSheets() < 1) {
                throw new BusinessRuleException("Planilha sem abas.");
            }
            Sheet sheet = wb.getSheetAt(0);
            return parseSheet(sheet);
        }
    }

    public List<CobrancaUnidadeParsed> parse(InputStream xls) throws IOException {
        return parseRelatorio(xls).unidades();
    }

    private CobrancaRelatorioParseResult parseSheet(Sheet sheet) {
        CabecalhoPlanilha cab = lerCabecalhoPlanilha(sheet);
        List<CobrancaUnidadeParsed> resultado = new ArrayList<>();
        BlocoAtual bloco = null;
        Map<String, Integer> colunas = null;

        int last = sheet.getLastRowNum();
        for (int r = 0; r <= last; r++) {
            Row row = sheet.getRow(r);
            if (row == null) {
                continue;
            }
            String col0 = cell(row, 0);
            if (!StringUtils.hasText(col0)) {
                continue;
            }

            if (isLinhaSubtotal(col0)) {
                if (bloco != null) {
                    resultado.add(bloco.build());
                    bloco = null;
                    colunas = null;
                }
                continue;
            }

            if (col0.contains("Proprietário:")) {
                if (bloco != null) {
                    resultado.add(bloco.build());
                }
                bloco = parseInicioBlocoComProprietario(col0);
                colunas = null;
                continue;
            }

            if (isLinhaCodigoUnidade(col0)) {
                if (bloco != null) {
                    resultado.add(bloco.build());
                }
                bloco = parseInicioBlocoSomenteCodigo(col0);
                colunas = null;
                continue;
            }

            if (isLinhaCabecalhoGrade(col0)) {
                colunas = mapearCabecalhoGrade(row);
                continue;
            }

            if (bloco == null || colunas == null) {
                continue;
            }

            Optional<InadimplenciaCobrancaDto> cob = parseLinhaDebito(row, colunas);
            if (cob.isPresent()) {
                bloco.cobrancas.add(cob.get());
            }
        }

        if (bloco != null) {
            resultado.add(bloco.build());
        }
        return new CobrancaRelatorioParseResult(resultado, cab.condominioNome(), cab.dataReferencia());
    }

    private CabecalhoPlanilha lerCabecalhoPlanilha(Sheet sheet) {
        String condominioNome = "";
        String dataReferencia = "";
        int limite = Math.min(sheet.getLastRowNum(), 20);
        for (int r = 0; r <= limite; r++) {
            Row row = sheet.getRow(r);
            if (row == null) {
                continue;
            }
            String col0 = cell(row, 0);
            if (!StringUtils.hasText(col0)) {
                continue;
            }
            Matcher data = PAT_DATA_REFERENCIA.matcher(col0.trim());
            if (data.find()) {
                dataReferencia = data.group(1).trim();
                continue;
            }
            if (r == 0) {
                condominioNome = col0.trim();
            }
        }
        return new CabecalhoPlanilha(condominioNome, dataReferencia);
    }

    private BlocoAtual parseInicioBlocoComProprietario(String col0) {
        Matcher m = PAT_PROPRIETARIO.matcher(col0);
        if (!m.find()) {
            throw new BusinessRuleException("Bloco de unidade sem Proprietário reconhecível.");
        }
        String codigoRaw = extrairCodigoBruto(col0);
        String nome = m.group(1).trim();
        String doc = somenteDigitos(m.group(2));
        return new BlocoAtual(normalizarCodigoUnidade(codigoRaw), nome, doc);
    }

    private BlocoAtual parseInicioBlocoSomenteCodigo(String col0) {
        String codigoRaw = extrairCodigoBruto(col0);
        return new BlocoAtual(normalizarCodigoUnidade(codigoRaw), "", "");
    }

    private static boolean isLinhaCodigoUnidade(String col0) {
        if (!StringUtils.hasText(col0) || col0.contains("\n") || col0.contains(":")) {
            return false;
        }
        return PAT_CODIGO_UNIDADE_COL0.matcher(col0.trim()).matches();
    }

    static String extrairCodigoBruto(String col0) {
        int nl = col0.indexOf('\n');
        String linha = nl >= 0 ? col0.substring(0, nl) : col0;
        String t = linha.trim();
        if (t.endsWith("*")) {
            t = t.substring(0, t.length() - 1).trim();
        }
        return t;
    }

    static String normalizarCodigoUnidade(String codigoBruto) {
        return CobrancaUnidadeFormatUtil.normalizarCodigoUnidade(codigoBruto);
    }

    private static boolean isLinhaSubtotal(String col0) {
        return PAT_SUBTOTAL.matcher(col0.trim()).matches();
    }

    private static boolean isLinhaCabecalhoGrade(String col0) {
        return HDR_TIPO.equals(normalizarRotulo(col0));
    }

    private Map<String, Integer> mapearCabecalhoGrade(Row row) {
        Map<String, Integer> map = new HashMap<>();
        short last = row.getLastCellNum();
        for (int c = 0; c < last; c++) {
            String label = cell(row, c);
            if (!StringUtils.hasText(label)) {
                continue;
            }
            String chave = chaveCabecalho(label);
            if (chave != null) {
                map.put(chave, c);
            }
        }
        return map;
    }

    private static String chaveCabecalho(String label) {
        String n = normalizarRotulo(label);
        if (HDR_TIPO.equals(n)) {
            return HDR_TIPO;
        }
        if (HDR_DOC.equals(n)) {
            return HDR_DOC;
        }
        if (HDR_PERIODO.equals(n) || "período".equals(n)) {
            return HDR_PERIODO;
        }
        if (HDR_VENCIMENTO.equals(n)) {
            return HDR_VENCIMENTO;
        }
        if (HDR_VALOR.equals(n)) {
            return HDR_VALOR;
        }
        if (HDR_MULTA.equals(n)) {
            return HDR_MULTA;
        }
        return null;
    }

    private Optional<InadimplenciaCobrancaDto> parseLinhaDebito(Row row, Map<String, Integer> colunas) {
        Integer idxTipo = colunas.get(HDR_TIPO);
        if (idxTipo == null) {
            return Optional.empty();
        }
        String receita = cell(row, idxTipo);
        if (!StringUtils.hasText(receita) || HDR_TIPO.equals(normalizarRotulo(receita))) {
            return Optional.empty();
        }

        String doc = textoColuna(row, colunas, HDR_DOC);
        String periodo = textoColuna(row, colunas, HDR_PERIODO);
        String vencimento = textoColuna(row, colunas, HDR_VENCIMENTO);
        String valorStr = textoColuna(row, colunas, HDR_VALOR);
        if (!StringUtils.hasText(valorStr)) {
            return Optional.empty();
        }
        String multaRaw = textoColuna(row, colunas, HDR_MULTA);
        String multa = StringUtils.hasText(multaRaw) ? multaRaw.trim() : "";

        long centavos = CalculoApplicationService.parseValorInicialParaCentavos(valorStr);
        return Optional.of(new InadimplenciaCobrancaDto(
                receita.trim(), doc, periodo, vencimento, valorStr.trim(), centavos, multa));
    }

    private String textoColuna(Row row, Map<String, Integer> colunas, String chave) {
        Integer idx = colunas.get(chave);
        if (idx == null) {
            return "";
        }
        return cell(row, idx);
    }

    private String cell(Row row, int col) {
        Cell cell = row.getCell(col);
        if (cell == null) {
            return "";
        }
        return formatter.formatCellValue(cell).trim();
    }

    private static String normalizarRotulo(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().toLowerCase(Locale.ROOT);
    }

    static String somenteDigitos(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replaceAll("\\D", "");
    }

    private record CabecalhoPlanilha(String condominioNome, String dataReferencia) {}

    private static final class BlocoAtual {
        final String codigo;
        final String proprietarioNome;
        final String proprietarioDoc;
        final List<InadimplenciaCobrancaDto> cobrancas = new ArrayList<>();

        BlocoAtual(String codigo, String proprietarioNome, String proprietarioDoc) {
            this.codigo = codigo;
            this.proprietarioNome = proprietarioNome;
            this.proprietarioDoc = proprietarioDoc;
        }

        CobrancaUnidadeParsed build() {
            return new CobrancaUnidadeParsed(codigo, proprietarioNome, proprietarioDoc, List.copyOf(cobrancas));
        }
    }

}
