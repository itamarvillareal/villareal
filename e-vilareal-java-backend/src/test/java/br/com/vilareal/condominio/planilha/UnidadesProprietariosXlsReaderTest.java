package br.com.vilareal.condominio.planilha;

import br.com.vilareal.condominio.api.dto.UnidadePlanilhaLinhaDto;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UnidadesProprietariosXlsReaderTest {

    @Test
    void lerLinhas_extraiProprietarioEnderecoUnidade() throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row h = sh.createRow(UnidadesProprietariosXlsReader.HEADER_ROW_INDEX);
            h.createCell(0).setCellValue("Unidade");

            Row d = sh.createRow(UnidadesProprietariosXlsReader.DATA_FIRST_ROW_INDEX);
            d.createCell(0).setCellValue("A-0103");
            d.createCell(2).setCellValue("Maria Silva");
            d.createCell(3).setCellValue("123.456.789-01");
            d.createCell(4).setCellValue("MG-12.345.678");
            d.createCell(5).setCellValue("a@b.com;b@c.com");
            d.createCell(6).setCellValue("(62) 1111-1111");
            d.createCell(7).setCellValue("");
            d.createCell(9).setCellValue("");
            d.createCell(10).setCellValue("");
            d.createCell(24).setCellValue("75100-000");
            d.createCell(25).setCellValue("Rua das Flores");
            d.createCell(26).setCellValue("100");
            d.createCell(27).setCellValue("Centro");
            d.createCell(28).setCellValue("Apto 1");
            d.createCell(29).setCellValue("Anápolis - GO");

            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            wb.write(bos);
            try (ByteArrayInputStream in = new ByteArrayInputStream(bos.toByteArray())) {
                List<UnidadePlanilhaLinhaDto> rows = UnidadesProprietariosXlsReader.lerLinhas(in);
                assertEquals(1, rows.size());
                UnidadePlanilhaLinhaDto r = rows.getFirst();
                assertEquals("A-0103", r.codigoUnidade());
                assertEquals("MARIA SILVA", r.proprietario().nome());
                assertEquals("12345678901", r.proprietario().cpfCnpjNormalizado());
                assertEquals(2, r.proprietario().emails().size());
                assertEquals(1, r.proprietario().telefones().size());
                assertEquals("Anápolis", r.endereco().cidade());
                assertEquals("GO", r.endereco().uf());
                assertEquals("Apto 1", r.endereco().complemento());
                assertTrue(r.endereco().logradouro().contains("Flores"));
            }
        }
    }
}
