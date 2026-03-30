package br.com.vilareal.importacao;

import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PlanilhaExcelUtilTest {

    @Test
    void linhaVazia() throws Exception {
        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            assertThat(PlanilhaExcelUtil.linhaTotalmenteVaziaAteColuna(r, 14)).isTrue();
            r.createCell(0).setCellValue("x");
            assertThat(PlanilhaExcelUtil.linhaTotalmenteVaziaAteColuna(r, 14)).isFalse();
        }
    }

    @Test
    void cellStringNumericoInteiro() throws Exception {
        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            r.createCell(0).setCellValue(42.0);
            assertThat(PlanilhaExcelUtil.cellString(r, 0)).isEqualTo("42");
        }
    }
}
