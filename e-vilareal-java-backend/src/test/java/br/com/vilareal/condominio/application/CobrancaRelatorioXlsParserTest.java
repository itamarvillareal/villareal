package br.com.vilareal.condominio.application;

import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CobrancaRelatorioXlsParserTest {

    private final CobrancaRelatorioXlsParser parser = new CobrancaRelatorioXlsParser();

    @Test
    void parseRelatorio_extraiCabecalhoCondominioEDataReferencia() throws Exception {
        try (XSSFWorkbook wb = workbookBase()) {
            CobrancaRelatorioParseResult r = parseResult(wb);
            assertThat(r.condominioNome()).isEqualTo("Condomínio Exemplo");
            assertThat(r.dataReferencia()).isEqualTo("10/04/2026");
        }
    }

    @Test
    void parse_unidadePfA0402_umDebito_valorNominal() throws Exception {
        try (XSSFWorkbook wb = workbookBase()) {
            Sheet sh = wb.getSheetAt(0);
            int r = 3;
            sh.createRow(r++).createCell(0).setCellValue(
                    "A0402 \nProprietário: Letycia de Paula Machado (849.657.031-20) \n(62) 9999");
            criarCabecalhoGrade(sh.createRow(r++), 8);
            Row debito = sh.createRow(r++);
            debito.createCell(0).setCellValue("Ordinária");
            debito.createCell(8).setCellValue("Inquilino Ignorado");
            debito.createCell(2).setCellValue("238");
            debito.createCell(5).setCellValue("04/2026");
            debito.createCell(6).setCellValue("10/04/2026");
            debito.createCell(10).setCellValue("658,77");
            debito.createCell(13).setCellValue("9.999,99");
            sh.createRow(r).createCell(0).setCellValue("A0402: 1 cobrança");

            List<CobrancaUnidadeParsed> out = parse(wb);
            assertThat(out).hasSize(1);
            CobrancaUnidadeParsed u = out.getFirst();
            assertThat(u.codigoUnidadeNormalizada()).isEqualTo("A-0402");
            assertThat(u.proprietarioNome()).isEqualTo("Letycia de Paula Machado");
            assertThat(u.proprietarioDocDigitos()).hasSize(11).isEqualTo("84965703120");
            assertThat(u.cobrancas()).hasSize(1);
            InadimplenciaCobrancaDto c = u.cobrancas().getFirst();
            assertThat(c.valorCentavos()).isEqualTo(65877L);
            assertThat(c.valor()).isEqualTo("658,77");
            assertThat(c.receita()).isEqualTo("Ordinária");
        }
    }

    @Test
    void parse_unidadePjA0501_multiDebitos() throws Exception {
        try (XSSFWorkbook wb = workbookBase()) {
            Sheet sh = wb.getSheetAt(0);
            int r = 3;
            sh.createRow(r++).createCell(0).setCellValue(
                    "A0501* \nProprietário: Spe Comercio Ltda. (21.168.585/0001-23) \nemail");
            criarCabecalhoGrade(sh.createRow(r++), 8);
            Row d1 = sh.createRow(r++);
            d1.createCell(0).setCellValue("Ordinária");
            d1.createCell(2).setCellValue("100");
            d1.createCell(5).setCellValue("03/2026");
            d1.createCell(6).setCellValue("05/03/2026");
            d1.createCell(10).setCellValue("500,00");
            Row d2 = sh.createRow(r++);
            d2.createCell(0).setCellValue("Extra");
            d2.createCell(2).setCellValue("101");
            d2.createCell(5).setCellValue("04/2026");
            d2.createCell(6).setCellValue("10/04/2026");
            d2.createCell(10).setCellValue("1.234,56");
            sh.createRow(r).createCell(0).setCellValue("A0501: 2 cobrança");

            List<CobrancaUnidadeParsed> out = parse(wb);
            assertThat(out).hasSize(1);
            CobrancaUnidadeParsed u = out.getFirst();
            assertThat(u.codigoUnidadeNormalizada()).isEqualTo("A-0501");
            assertThat(u.proprietarioDocDigitos()).hasSize(14).isEqualTo("21168585000123");
            assertThat(u.cobrancas()).hasSize(2);
            assertThat(u.cobrancas().get(0).valorCentavos()).isEqualTo(50000L);
            assertThat(u.cobrancas().get(1).valorCentavos()).isEqualTo(123456L);
        }
    }

    @Test
    void parse_blocoAdm_codigoLiteral() throws Exception {
        try (XSSFWorkbook wb = workbookBase()) {
            Sheet sh = wb.getSheetAt(0);
            int r = 3;
            sh.createRow(r++).createCell(0).setCellValue(
                    "ADM \nProprietário: Terra Mundi Anapolis I (46.619.657/0001-32) \ncontato");
            criarCabecalhoGrade(sh.createRow(r++), 8);
            Row d = sh.createRow(r++);
            d.createCell(0).setCellValue("Ordinária");
            d.createCell(10).setCellValue("100,00");
            sh.createRow(r).createCell(0).setCellValue("ADM: 1 cobrança");

            CobrancaUnidadeParsed u = parse(wb).getFirst();
            assertThat(u.codigoUnidadeNormalizada()).isEqualTo("ADM");
            assertThat(u.proprietarioNome()).contains("Terra Mundi");
        }
    }

    @Test
    void parse_variosBlocos_incluiPfPjEAdm() throws Exception {
        try (XSSFWorkbook wb = workbookBase()) {
            Sheet sh = wb.getSheetAt(0);
            int r = 3;
            adicionarBloco(sh, r, "A0402 \nProprietário: Maria (111.444.777-35) \n", "Ordinária", "100,00");
            r += 4;
            adicionarBloco(
                    sh,
                    r,
                    "A0501* \nProprietário: Empresa (22.222.222/0001-22) \n",
                    "Ordinária",
                    "200,00");
            r += 4;
            adicionarBloco(
                    sh,
                    r,
                    "ADM \nProprietário: Admin (33.333.333/0001-33) \n",
                    "Taxa",
                    "50,00");

            assertThat(parse(wb)).hasSize(3);
        }
    }

    @Test
    void parse_unidadeSomenteCodigoCol0_semProprietario() throws Exception {
        try (XSSFWorkbook wb = workbookBase()) {
            Sheet sh = wb.getSheetAt(0);
            int r = 3;
            sh.createRow(r++).createCell(0).setCellValue("A0402");
            criarCabecalhoGradeNovoExport(sh.createRow(r++));
            Row debito = sh.createRow(r++);
            debito.createCell(0).setCellValue("Ordinária");
            debito.createCell(3).setCellValue("14189");
            debito.createCell(6).setCellValue("05/2026");
            debito.createCell(7).setCellValue("10/05/2026");
            debito.createCell(10).setCellValue("607,46");
            sh.createRow(r).createCell(0).setCellValue("A0402: 1 cobrança(s)");

            List<CobrancaUnidadeParsed> out = parse(wb);
            assertThat(out).hasSize(1);
            CobrancaUnidadeParsed u = out.getFirst();
            assertThat(u.codigoUnidadeNormalizada()).isEqualTo("A-0402");
            assertThat(u.proprietarioNome()).isEmpty();
            assertThat(u.proprietarioDocDigitos()).isEmpty();
            assertThat(u.cobrancas()).hasSize(1);
            assertThat(u.cobrancas().getFirst().valorCentavos()).isEqualTo(60746L);
        }
    }

    @Test
    void parse_arquivoRealInadimplencia20260610() throws Exception {
        java.nio.file.Path path = java.nio.file.Paths.get(
                System.getProperty("user.home"), "Downloads", "inadimplencia-20260610-132920.xls");
        org.junit.jupiter.api.Assumptions.assumeTrue(
                java.nio.file.Files.isRegularFile(path), "Planilha de teste ausente em Downloads");
        try (var in = java.nio.file.Files.newInputStream(path)) {
            CobrancaRelatorioParseResult r = parser.parseRelatorio(in);
            assertThat(r.condominioNome()).contains("Terra Mundi");
            assertThat(r.dataReferencia()).contains("10/06/2026");
            assertThat(r.unidades()).hasSizeGreaterThanOrEqualTo(50);
            assertThat(r.unidades().stream().mapToInt(u -> u.cobrancas().size()).sum())
                    .isGreaterThanOrEqualTo(180);
        }
    }

    @Test
    void normalizarCodigoUnidade_variacoes() {
        assertThat(CobrancaRelatorioXlsParser.normalizarCodigoUnidade("A0402")).isEqualTo("A-0402");
        assertThat(CobrancaRelatorioXlsParser.normalizarCodigoUnidade("000-A")).isEqualTo("A-0000");
        assertThat(CobrancaRelatorioXlsParser.normalizarCodigoUnidade("1201-R")).isEqualTo("R-1201");
        assertThat(CobrancaRelatorioXlsParser.normalizarCodigoUnidade("ADM")).isEqualTo("ADM");
        assertThat(CobrancaRelatorioXlsParser.extrairCodigoBruto("A0501* \nProprietário: X (1)"))
                .isEqualTo("A0501");
    }

    private static void adicionarBloco(Sheet sh, int startRow, String blocoCol0, String tipo, String valor) {
        int r = startRow;
        sh.createRow(r++).createCell(0).setCellValue(blocoCol0);
        criarCabecalhoGrade(sh.createRow(r++), 8);
        Row d = sh.createRow(r++);
        d.createCell(0).setCellValue(tipo);
        d.createCell(10).setCellValue(valor);
        sh.createRow(r).createCell(0).setCellValue("X: 1 cobrança");
    }

    /** Layout export 2026+: Doc col 3, Período 6, Vencimento 7, Valor 10 (sem col Pagador). */
    private static void criarCabecalhoGradeNovoExport(Row h) {
        h.createCell(0).setCellValue("Tipo");
        h.createCell(2).setCellValue("Parc");
        h.createCell(3).setCellValue("Doc");
        h.createCell(4).setCellValue("N. Número");
        h.createCell(6).setCellValue("Período");
        h.createCell(7).setCellValue("Vencimento");
        h.createCell(9).setCellValue("Dias");
        h.createCell(10).setCellValue("Valor");
        h.createCell(11).setCellValue("Multa");
        h.createCell(12).setCellValue("Juros");
        h.createCell(13).setCellValue("Atual.");
        h.createCell(14).setCellValue("Hon.");
        h.createCell(16).setCellValue("Vl.Atual.");
    }

    /** Pagador na col 8; Valor nominal na 10; Vl.Atual. na 13. */
    private static void criarCabecalhoGrade(Row h, int colPagador) {
        h.createCell(0).setCellValue("Tipo");
        h.createCell(1).setCellValue("Parc");
        h.createCell(2).setCellValue("Doc");
        h.createCell(3).setCellValue("N. Número");
        h.createCell(5).setCellValue("Período");
        h.createCell(6).setCellValue("Vencimento");
        h.createCell(7).setCellValue("Dias");
        h.createCell(colPagador).setCellValue("Pagador");
        h.createCell(9).setCellValue("Multa");
        h.createCell(10).setCellValue("Valor");
        h.createCell(11).setCellValue("Juros");
        h.createCell(12).setCellValue("Atual.");
        h.createCell(13).setCellValue("Vl.Atual.");
    }

    private static XSSFWorkbook workbookBase() {
        XSSFWorkbook wb = new XSSFWorkbook();
        Sheet sh = wb.createSheet("Page 1");
        sh.createRow(0).createCell(0).setCellValue("Condomínio Exemplo");
        sh.createRow(1).createCell(0).setCellValue("Inadimplência");
        sh.createRow(2).createCell(0).setCellValue("Data de referência: 10/04/2026");
        return wb;
    }

    private List<CobrancaUnidadeParsed> parse(XSSFWorkbook wb) throws Exception {
        return parseResult(wb).unidades();
    }

    private CobrancaRelatorioParseResult parseResult(XSSFWorkbook wb) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        wb.write(bos);
        try (ByteArrayInputStream in = new ByteArrayInputStream(bos.toByteArray())) {
            return parser.parseRelatorio(in);
        }
    }
}
