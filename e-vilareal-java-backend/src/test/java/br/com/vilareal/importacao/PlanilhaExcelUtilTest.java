package br.com.vilareal.importacao;

import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormat;
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

    /**
     * Reproduz o bug do imóvel 43: valor 1700 numa célula FORMATADA como data
     * (serial 1700 = 26/08/1904). {@code cellString} devolve a data; a leitura monetária
     * deve devolver o serial numérico (1700).
     */
    @Test
    void cellValorMonetario_celulaNumericaFormatadaComoData_usaSerial() throws Exception {
        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            Cell cell = r.createCell(0);
            cell.setCellValue(1700.0);
            CellStyle style = wb.createCellStyle();
            DataFormat fmt = wb.createDataFormat();
            style.setDataFormat(fmt.getFormat("dd/mm/yyyy"));
            cell.setCellStyle(style);

            assertThat(PlanilhaExcelUtil.cellString(r, 0)).contains("/");
            assertThat(PlanilhaExcelUtil.cellValorMonetarioString(r, 0)).isEqualTo("1.700");
            assertThat(ImoveisPlanilhaImportSupport.parseValorRealBr(
                            PlanilhaExcelUtil.cellValorMonetarioString(r, 0)))
                    .isEqualByComparingTo(new java.math.BigDecimal("1700.00"));
        }
    }

    @Test
    void cellValorMonetario_celulaNumericaComCentavos() throws Exception {
        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            r.createCell(0).setCellValue(1234.56);
            assertThat(ImoveisPlanilhaImportSupport.parseValorRealBr(
                            PlanilhaExcelUtil.cellValorMonetarioString(r, 0)))
                    .isEqualByComparingTo(new java.math.BigDecimal("1234.56"));
        }
    }

    @Test
    void cellValorMonetario_celulaTextoMantemComportamento() throws Exception {
        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            r.createCell(0).setCellValue("R$ 1.700,50");
            assertThat(ImoveisPlanilhaImportSupport.parseValorRealBr(
                            PlanilhaExcelUtil.cellValorMonetarioString(r, 0)))
                    .isEqualByComparingTo(new java.math.BigDecimal("1700.50"));
        }
    }

    /**
     * Reproduz o bug das datas de contrato: célula DATE formatada como "m/d/yy" (americano).
     * {@code cellString} devolveria "4/15/26" (mês 15 inválido em pt-BR → default 2000);
     * a leitura por serial deve devolver "15/04/2026".
     */
    @Test
    void cellData_celulaDataFormatoAmericano_usaSerial() throws Exception {
        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            Cell cell = r.createCell(0);
            cell.setCellValue(java.time.LocalDate.of(2026, 4, 15));
            CellStyle style = wb.createCellStyle();
            DataFormat fmt = wb.createDataFormat();
            style.setDataFormat(fmt.getFormat("m/d/yy"));
            cell.setCellStyle(style);

            assertThat(PlanilhaExcelUtil.cellDataString(r, 0)).isEqualTo("15/04/2026");
            assertThat(ImoveisPlanilhaImportSupport.parseDataFlex(PlanilhaExcelUtil.cellDataString(r, 0)))
                    .isEqualTo(java.time.LocalDate.of(2026, 4, 15));
        }
    }

    @Test
    void cellData_celulaTextoMantemComportamento() throws Exception {
        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            r.createCell(0).setCellValue("15/04/2026");
            assertThat(PlanilhaExcelUtil.cellDataString(r, 0)).isEqualTo("15/04/2026");
        }
    }
}
