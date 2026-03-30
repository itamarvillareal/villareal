package br.com.vilareal.importacao;

import br.com.vilareal.importacao.dto.Pasta1ClientePessoaListaResponse;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class Pasta1ClientePessoaReaderTest {

    @Test
    void leColunaAeBParandoEmAVazia() throws Exception {
        Pasta1ClientePessoaReader reader = new Pasta1ClientePessoaReader();
        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r0 = sh.createRow(0);
            r0.createCell(0).setCellValue(1);
            r0.createCell(1).setCellValue(64);
            Row r1 = sh.createRow(1);
            r1.createCell(0).setCellValue(2);
            r1.createCell(1).setCellValue(89);
            Row r2 = sh.createRow(2);
            r2.createCell(0).setCellValue("");
            Pasta1ClientePessoaListaResponse out = reader.lerSheet(sh, "mem");
            assertThat(out.getItens()).hasSize(2);
            assertThat(out.getItens().get(0).getClienteColunaA()).isEqualTo("1");
            assertThat(out.getItens().get(0).getPessoaId()).isEqualTo(64L);
            assertThat(out.getItens().get(1).getPessoaId()).isEqualTo(89L);
        }
    }

    @Test
    void ignoraPrimeiraLinhaSeParecerCabecalho() throws Exception {
        Pasta1ClientePessoaReader reader = new Pasta1ClientePessoaReader();
        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r0 = sh.createRow(0);
            r0.createCell(0).setCellValue("Cliente");
            r0.createCell(1).setCellValue("Pessoa");
            Row r1 = sh.createRow(1);
            r1.createCell(0).setCellValue(10);
            r1.createCell(1).setCellValue(999);
            Pasta1ClientePessoaListaResponse out = reader.lerSheet(sh, "mem");
            assertThat(out.getItens()).hasSize(1);
            assertThat(out.getItens().get(0).getPessoaId()).isEqualTo(999L);
        }
    }
}
