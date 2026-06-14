package br.com.vilareal.importacao;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

final class PlanilhaExcelUtil {

    private static final DataFormatter DATA_FORMATTER = new DataFormatter();
    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/uuuu");

    private PlanilhaExcelUtil() {}

    static boolean linhaTotalmenteVaziaAteColuna(Row row, int ultimaColInclusive) {
        if (row == null) {
            return true;
        }
        for (int c = 0; c <= ultimaColInclusive; c++) {
            if (org.springframework.util.StringUtils.hasText(cellString(row, c))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Texto como o Excel exibe (importante para CNJ com pontos: célula numérica não pode usar
     * {@code getNumericCellValue()} — perde tudo após o primeiro segmento).
     *
     * <p>Aplica {@link Utf8MojibakeUtil#corrigir(String)} ao texto (UTF-8/Latin-1 mal interpretados em
     * planilhas legadas), sem alterar dígitos de identificadores numéricos formatados como texto.
     */
    static String cellString(Row row, int colIndex) {
        if (row == null) {
            return "";
        }
        Cell cell = row.getCell(colIndex);
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            return "";
        }
        String raw = DATA_FORMATTER.formatCellValue(cell).trim();
        String fixed = Utf8MojibakeUtil.corrigir(raw);
        return fixed != null ? fixed : "";
    }

    /**
     * Texto de uma coluna de <strong>valor monetário</strong> (valor da locação, garantia, etc.).
     *
     * <p>Quando a célula é numérica usa o <strong>valor numérico bruto (serial)</strong> da célula —
     * <em>nunca</em> a string formatada. Isto corrige planilhas legadas em que uma célula com valor
     * {@code 1700} está formatada como data ({@code "26/08/1904"}): {@link #cellString} devolveria a
     * data e o parser extrairia {@code 26}; aqui devolvemos o valor numérico em formato pt-BR
     * ({@code "1.700"}) para {@link ImoveisPlanilhaImportSupport#parseValorRealBr(String)}.
     *
     * <p>Para células de texto ({@code "R$ 1.700,00"}, {@code "1.700,50"}) mantém o comportamento de
     * {@link #cellString}. Não deve ser usado em colunas de data reais (início/fim de contrato,
     * vencimentos), que continuam a usar {@link #cellString}.
     */
    static String cellValorMonetarioString(Row row, int colIndex) {
        if (row == null) {
            return "";
        }
        Cell cell = row.getCell(colIndex);
        if (cell == null) {
            return "";
        }
        CellType type = cell.getCellType();
        if (type == CellType.FORMULA) {
            type = cell.getCachedFormulaResultType();
        }
        if (type == CellType.NUMERIC) {
            return formatarValorPtBr(cell.getNumericCellValue());
        }
        return cellString(row, colIndex);
    }

    private static String formatarValorPtBr(double valor) {
        DecimalFormat df = new DecimalFormat("#,##0.####", DecimalFormatSymbols.getInstance(PT_BR));
        return df.format(valor);
    }

    /**
     * Texto de uma coluna de <strong>data</strong> (início/fim de contrato, datas de consulta, etc.).
     *
     * <p>Quando a célula é uma data do Excel usa o <strong>valor numérico (serial)</strong> e devolve
     * sempre em {@code dd/MM/uuuu} — <em>nunca</em> a string formatada. Isto corrige planilhas legadas
     * em que a célula está formatada como {@code m/d/yy} (americano): {@link #cellString} devolveria
     * {@code "4/15/26"} e o parser pt-BR (dia/mês) leria mês 15 (inválido) → data perdida (caía no
     * default {@code 2000-01-01}). Lendo o serial obtemos a data real ({@code 15/04/2026}).
     *
     * <p>Para células de texto mantém {@link #cellString} (datas já em {@code dd/MM/aaaa}). Não deve
     * ser usado em colunas de valor monetário — essas usam {@link #cellValorMonetarioString}.
     */
    static String cellDataString(Row row, int colIndex) {
        if (row == null) {
            return "";
        }
        Cell cell = row.getCell(colIndex);
        if (cell == null) {
            return "";
        }
        CellType type = cell.getCellType();
        if (type == CellType.FORMULA) {
            type = cell.getCachedFormulaResultType();
        }
        if (type == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            double v = cell.getNumericCellValue();
            if (DateUtil.isValidExcelDate(v)) {
                return DateUtil.getLocalDateTime(v).toLocalDate().format(DATA_BR);
            }
        }
        return cellString(row, colIndex);
    }
}
