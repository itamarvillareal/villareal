package br.com.vilareal.importacao;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;

import java.time.LocalDate;

/**
 * Datas e valores da planilha «Dados complementares processos» (col. G, L podem ser serial Excel).
 */
final class ComplementaresProcessosPlanilhaUtil {

    private ComplementaresProcessosPlanilhaUtil() {}

    static LocalDate parseDataCelulaOpcional(Row row, int colIndex) {
        if (row == null) {
            return null;
        }
        Cell cell = row.getCell(colIndex);
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            return null;
        }
        CellType type = cell.getCellType();
        if (type == CellType.NUMERIC) {
            double v = cell.getNumericCellValue();
            if (DateUtil.isValidExcelDate(v)) {
                return DateUtil.getLocalDateTime(v).toLocalDate();
            }
            return null;
        }
        String s = PlanilhaExcelUtil.cellString(row, colIndex);
        return ImoveisPlanilhaImportSupport.parseDataFlex(s);
    }
}
