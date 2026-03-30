package br.com.vilareal.importacao;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;

final class PlanilhaExcelUtil {

    private static final DataFormatter DATA_FORMATTER = new DataFormatter();

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
     */
    static String cellString(Row row, int colIndex) {
        if (row == null) {
            return "";
        }
        Cell cell = row.getCell(colIndex);
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            return "";
        }
        return DATA_FORMATTER.formatCellValue(cell).trim();
    }
}
