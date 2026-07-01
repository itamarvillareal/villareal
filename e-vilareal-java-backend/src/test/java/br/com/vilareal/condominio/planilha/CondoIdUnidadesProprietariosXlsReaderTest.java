package br.com.vilareal.condominio.planilha;

import br.com.vilareal.condominio.api.dto.UnidadePlanilhaLinhaDto;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CondoIdUnidadesProprietariosXlsReaderTest {

    @Test
    void lerLinhas_extraiUnidadeHierarquicaComEnderecoETelefones() throws Exception {
        byte[] bytes = planilhaCondoIdMinima();
        CondoIdUnidadesProprietariosXlsReader.LeituraResult r;
        try (ByteArrayInputStream in = new ByteArrayInputStream(bytes)) {
            r = CondoIdUnidadesProprietariosXlsReader.lerLinhas(in);
        }
        assertEquals(2, r.linhas().size());
        assertEquals(1, r.unidadesComCoproprietariosAdicionais());

        UnidadePlanilhaLinhaDto lt01 = r.linhas().getFirst();
        assertEquals("QD01-LT01", lt01.codigoUnidade());
        assertEquals("ALEX SOUSA GUEDES", lt01.proprietario().nome());
        assertEquals("03772491146", lt01.proprietario().cpfCnpjNormalizado());
        assertEquals("alexsousa.15@gmail.cm", lt01.proprietario().emails().getFirst());

        UnidadePlanilhaLinhaDto lt02 = r.linhas().get(1);
        assertEquals("QD01-LT02", lt02.codigoUnidade());
        assertEquals("DANILO ITALO ALVES BARBOSA", lt02.proprietario().nome());
        assertEquals(2, lt02.proprietario().telefones().size());
        assertEquals("Goiânia", lt02.endereco().cidade());
        assertEquals("GO", lt02.endereco().uf());
    }

    @Test
    void planilhaReader_detectaFormatoCondoId() throws Exception {
        byte[] bytes = planilhaCondoIdMinima();
        UnidadesProprietariosPlanilhaReader.LeituraResult r;
        try (ByteArrayInputStream in = new ByteArrayInputStream(bytes)) {
            r = UnidadesProprietariosPlanilhaReader.ler(in);
        }
        assertEquals("CONDO_ID", r.formatoDetectado());
        assertEquals(2, r.linhas().size());
    }

    static boolean xlsxFarolLagoDisponivel() {
        return Files.isRegularFile(
                Path.of("/Users/itamar/Downloads/01-07_0949_CONDÔMINOS POR UNIDADE - FAROLDOLAGO - CONDO ID.xlsx"));
    }

    @Test
    @EnabledIf("br.com.vilareal.condominio.planilha.CondoIdUnidadesProprietariosXlsReaderTest#xlsxFarolLagoDisponivel")
    void lerXlsxRealFarolLago_extraiCentenasDeUnidades() throws Exception {
        byte[] bytes = Files.readAllBytes(
                Path.of("/Users/itamar/Downloads/01-07_0949_CONDÔMINOS POR UNIDADE - FAROLDOLAGO - CONDO ID.xlsx"));
        UnidadesProprietariosPlanilhaReader.LeituraResult r;
        try (ByteArrayInputStream in = new ByteArrayInputStream(bytes)) {
            r = UnidadesProprietariosPlanilhaReader.ler(in);
        }
        assertEquals("CONDO_ID", r.formatoDetectado());
        assertTrue(r.linhas().size() >= 200, "unidades=" + r.linhas().size());
        assertTrue(r.unidadesComCoproprietariosAdicionais() >= 5);
        assertTrue(r.linhas().stream().anyMatch(u -> "QD01-LT01".equals(u.codigoUnidade())));
    }

    private static byte[] planilhaCondoIdMinima() throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            var sh = wb.createSheet("CondoId1");
            var h = sh.createRow(4);
            h.createCell(0).setCellValue("Nome");
            h.createCell(2).setCellValue("Tipo");
            h.createCell(4).setCellValue("CPF/CNPJ");
            h.createCell(8).setCellValue("E-mail");
            h.createCell(10).setCellValue("Contato");
            h.createCell(12).setCellValue("Endereço");

            sh.createRow(5).createCell(0).setCellValue("QD01-LT01");
            var p1 = sh.createRow(6);
            p1.createCell(0).setCellValue("ALEX SOUSA GUEDES");
            p1.createCell(1).setCellValue("1");
            p1.createCell(3).setCellValue("03772491146");
            p1.createCell(7).setCellValue("alexsousa.15@gmail.cm");

            var p2 = sh.createRow(7);
            p2.createCell(0).setCellValue("MARIA DA PENHA PERES MOURA");
            p2.createCell(1).setCellValue("1");
            p2.createCell(3).setCellValue("43766129104");

            sh.createRow(8).createCell(0).setCellValue("QD01-LT02");
            var p3 = sh.createRow(9);
            p3.createCell(0).setCellValue("DANILO ITALO ALVES BARBOSA");
            p3.createCell(1).setCellValue("1");
            p3.createCell(3).setCellValue("70431294194");
            p3.createCell(7).setCellValue("daniloitaloab@gmail.com");
            p3.createCell(9).setCellValue("62993577341 62992499827");
            p3.createCell(11).setCellValue("Rua Amoreira Conjunto Habitacional Jardim Goiânia - GO");

            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            wb.write(bos);
            return bos.toByteArray();
        }
    }
}
