package br.com.vilareal.financeiro.domain;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parser do export xlsx "Movimentação" do BTG Investimentos.
 *
 * <p>Convenção BTG: coluna Entrada/Saída {@code Credito} = saída de caixa (COMPRA no extrato);
 * {@code Debito} = entrada de caixa (VENDA no extrato).
 */
public final class BtgMovimentacaoParser {

    private static final Pattern CODIGO_PRODUTO =
            Pattern.compile("(CDB|LCA|LCI|CRA|CRI)\\s*-\\s*([A-Z0-9]{4,})", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/uuuu");
    private static final DataFormatter DATA_FORMATTER = new DataFormatter();

    private BtgMovimentacaoParser() {}

    public record LinhaMovimentacao(
            String naturezaMov,
            LocalDate dataMovimentacao,
            String tipoMovimentacao,
            String produtoRaw,
            String codigoProduto,
            String tipoProduto,
            String emissor,
            String instituicao,
            BigDecimal quantidade,
            BigDecimal precoUnitario,
            BigDecimal valorOperacao,
            String tipoExtrato) {}

    public record ResultadoParse(int totalLinhas, List<LinhaMovimentacao> linhasCdb) {}

    public static ResultadoParse parse(InputStream inputStream) throws IOException {
        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            Sheet sheet = workbook.getSheetAt(0);
            int totalLinhas = Math.max(0, sheet.getLastRowNum());
            List<LinhaMovimentacao> linhas = new ArrayList<>();
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) {
                    continue;
                }
                String tipoMov = cell(row, 2);
                if (!"COMPRA / VENDA".equalsIgnoreCase(tipoMov.trim())) {
                    continue;
                }
                String produto = cell(row, 3);
                Matcher codigo = CODIGO_PRODUTO.matcher(produto);
                if (!codigo.find()) {
                    continue;
                }
                BigDecimal valor = parseDecimal(cell(row, 7));
                if (valor == null || valor.compareTo(BigDecimal.ZERO) <= 0) {
                    continue;
                }
                LocalDate data = parseData(cell(row, 1));
                if (data == null) {
                    continue;
                }
                String natureza = normalizarNatureza(cell(row, 0));
                linhas.add(new LinhaMovimentacao(
                        natureza,
                        data,
                        tipoMov.trim(),
                        produto.trim(),
                        codigo.group(2).toUpperCase(Locale.ROOT),
                        codigo.group(1).toUpperCase(Locale.ROOT),
                        extrairEmissor(produto),
                        cell(row, 4).trim(),
                        parseDecimalOpcional(cell(row, 5)),
                        parseDecimalOpcional(cell(row, 6)),
                        valor.setScale(2, RoundingMode.HALF_UP),
                        tipoExtratoParaNatureza(natureza)));
            }
            return new ResultadoParse(totalLinhas, linhas);
        }
    }

    /** Crédito na movimentação BTG → COMPRA (saída) no extrato. */
    public static String tipoExtratoParaNatureza(String naturezaMov) {
        return "CREDITO".equalsIgnoreCase(naturezaMov) ? "C" : "V";
    }

    public static String extrairEmissorFin(String descricao) {
        if (!StringUtils.hasText(descricao)) {
            return null;
        }
        Matcher m = Pattern.compile(
                        "(?:COMPRA|VENDA)\\s*-?\\s*(?:CDB|LCA|LCI|CRA|CRI)\\s+(.+?)\\s+Venc",
                        Pattern.CASE_INSENSITIVE)
                .matcher(descricao);
        if (!m.find()) {
            return null;
        }
        return m.group(1).replaceAll("\\s+", " ").trim().toUpperCase(Locale.ROOT);
    }

    private static String extrairEmissor(String produto) {
        String[] parts = produto.split("-");
        if (parts.length < 3) {
            return null;
        }
        return parts[parts.length - 1].replaceAll("\\s+", " ").trim().toUpperCase(Locale.ROOT);
    }

    private static String normalizarNatureza(String raw) {
        String n = raw.trim().toLowerCase(Locale.ROOT);
        if (n.startsWith("cred")) {
            return "CREDITO";
        }
        if (n.startsWith("deb")) {
            return "DEBITO";
        }
        return raw.trim().toUpperCase(Locale.ROOT);
    }

    private static String cell(Row row, int col) {
        if (row == null) {
            return "";
        }
        Cell cell = row.getCell(col);
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            return "";
        }
        return DATA_FORMATTER.formatCellValue(cell).trim();
    }

    private static LocalDate parseData(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String t = raw.trim();
        try {
            if (t.contains("/")) {
                return LocalDate.parse(t, DATA_BR);
            }
            return LocalDate.parse(t);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static BigDecimal parseDecimalOpcional(String raw) {
        BigDecimal v = parseDecimal(raw);
        return v;
    }

    private static BigDecimal parseDecimal(String raw) {
        if (!StringUtils.hasText(raw) || "-".equals(raw.trim()) || "—".equals(raw.trim())) {
            return null;
        }
        String t = raw.trim().replace("R$", "").replace(" ", "");
        if (t.contains(",") && t.contains(".")) {
            t = t.replace(".", "").replace(",", ".");
        } else if (t.contains(",")) {
            t = t.replace(",", ".");
        }
        try {
            return new BigDecimal(t);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
