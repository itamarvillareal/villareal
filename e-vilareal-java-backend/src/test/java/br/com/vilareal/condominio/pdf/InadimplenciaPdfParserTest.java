package br.com.vilareal.condominio.pdf;

import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaUnidadeDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class InadimplenciaPdfParserTest {

    @Test
    void parseText_extraiUnidadeCobrancaDocComTokenExtraEValores() {
        String text =
                """
                Data de referência: 10/04/2026
                Condomínio Exemplo
                A-0103
                Doc N.Num Período Vencimento Valor Multa
                Taxa Ordinária 238 12512 04/2026 10/04/2026 658,77 0,00
                B-1604
                Taxa de Condomínio 99 04/2026 15/04/2026 1.234,56 0,00
                """;

        InadimplenciaPdfParser.InadimplenciaPdfParseResult r = InadimplenciaPdfParser.parseText(text);

        assertEquals("10/04/2026", r.dataReferenciaPdf());
        List<InadimplenciaUnidadeDto> u = r.unidades();
        assertEquals(2, u.size());
        assertEquals("A-0103", u.getFirst().codigoUnidade());
        List<InadimplenciaCobrancaDto> c0 = u.getFirst().cobrancas();
        assertEquals(1, c0.size());
        assertEquals("238", c0.getFirst().doc());
        assertEquals("04/2026", c0.getFirst().periodo());
        assertEquals(65877L, c0.getFirst().valorCentavos());

        assertEquals("B-1604", u.get(1).codigoUnidade());
        assertEquals(123456L, u.get(1).cobrancas().getFirst().valorCentavos());

        assertTrue(r.resumo().quantidadeCobrancas() >= 2);
    }

    @Test
    void parseText_unidadePartidaEmDuasLinhasE3Digitos() {
        String text =
                """
                Data de referência: 10/04/2026
                A-
                103
                Doc N.Num Período Vencimento Valor Multa
                Taxa 1 04/2026 10/04/2026 100,00 0,00
                5 B-804
                Taxa 2 05/2026 11/05/2026 1 200,50 0,00
                """;

        InadimplenciaPdfParser.InadimplenciaPdfParseResult r = InadimplenciaPdfParser.parseText(text);

        assertEquals(2, r.unidades().size());
        assertEquals("A-0103", r.unidades().get(0).codigoUnidade());
        assertEquals("B-0804", r.unidades().get(1).codigoUnidade());
        assertEquals(10000L, r.unidades().get(0).cobrancas().get(0).valorCentavos());
        assertEquals(120050L, r.unidades().get(1).cobrancas().get(0).valorCentavos());
    }

    @Test
    void parseText_ignoraLinhasEncargoAdministradora_multaJurosAtualizacaoHonorario() {
        String text =
                """
                Data de referência: 13/04/2026
                B-1601
                Receita Doc N.Num Período Vencimento Valor Multa Juros Atual. Hon. Vl.Atual.
                Taxa Ordinária, Taxa de Condomínio 100 04/2026 10/04/2026 500,00 0,00 0,00 0,00 0,00 500,00
                Multa, Multas e Juros S/ Atraso do Condomínio 195 12501 04/2026 09/04/2026 11,00 0,00 0,00 0,00 0,00 11,00
                Juros, Multas e Juros S/ Atraso do Condomínio 195 12501 04/2026 09/04/2026 10,26 0,00 0,00 0,00 0,00 10,26
                Atualização Monetária, Correção monetária S/ Atraso do Condomínio 195 12501 04/2026 09/04/2026 3,85 0,00 0,00 0,00 0,00 3,85
                Honorário administrativo, Honorários de cobrança administrativa 195 12501 04/2026 09/04/2026 55,00 0,00 0,00 0,00 0,00 55,00
                """;

        InadimplenciaPdfParser.InadimplenciaPdfParseResult r = InadimplenciaPdfParser.parseText(text);

        assertEquals(1, r.unidades().size());
        assertEquals("B-1601", r.unidades().getFirst().codigoUnidade());
        assertEquals(1, r.unidades().getFirst().cobrancas().size());
        assertEquals("100", r.unidades().getFirst().cobrancas().getFirst().doc());
        assertEquals(1, r.resumo().quantidadeCobrancas());
    }

    @Test
    void isReceitaEncargoAdministradora_detectaPrefixosNormalizados() {
        assertTrue(InadimplenciaPdfParser.isReceitaEncargoAdministradoraNaoImportavel("Multa, Multas e Juros"));
        assertTrue(InadimplenciaPdfParser.isReceitaEncargoAdministradoraNaoImportavel("juros, algo"));
        assertTrue(InadimplenciaPdfParser.isReceitaEncargoAdministradoraNaoImportavel("Correção monetária X"));
        assertFalse(InadimplenciaPdfParser.isReceitaEncargoAdministradoraNaoImportavel("Taxa Ordinária, Taxa de Condomínio"));
    }

    @Test
    void parseText_aceitaVariasColunasMonetariasAposVencimento_comoPdfTerraMundi() {
        String text =
                """
                Residencial Terra Mundi Inadimplência por Unidade
                Data de referência: 13/04/2026
                A-0103
                Receita Doc N.Num Período Vencimento Valor Multa Juros Atual. Hon. Vl.Atual.
                Taxa Ordinária, Taxa  de Condomínio 232 04/2026 10/04/2026 658,77 0,00 0,00 0,00 0,00 658,77
                TOTAL de A-0103: 1 cobrança(s) 658,77 0,00 0,00 0,00 0,00 658,77
                """;

        InadimplenciaPdfParser.InadimplenciaPdfParseResult r = InadimplenciaPdfParser.parseText(text);

        assertEquals("Residencial Terra Mundi", r.condominioNome());
        assertEquals("13/04/2026", r.dataReferenciaPdf());
        assertEquals(1, r.unidades().size());
        InadimplenciaCobrancaDto c = r.unidades().getFirst().cobrancas().getFirst();
        assertEquals("232", c.doc());
        assertEquals("04/2026", c.periodo());
        assertEquals(65877L, c.valorCentavos());
    }

    @Test
    void parseText_naoUsaLinhaDataReferenciaComoNomeCondominio() {
        String text =
                """
                Data de referência: 13/04/2026
                EDIFICIO EXEMPLO
                C-0001
                Doc N.Num Período Vencimento Valor Multa
                Taxa 9 01/2026 05/01/2026 10,00 0,00
                """;

        InadimplenciaPdfParser.InadimplenciaPdfParseResult r = InadimplenciaPdfParser.parseText(text);

        assertEquals("EDIFICIO EXEMPLO", r.condominioNome());
        assertEquals("13/04/2026", r.dataReferenciaPdf());
        assertEquals(1, r.unidades().size());
    }

    @Test
    void parseText_condoId_extraiUnidadesQuadraLoteECobrancas() {
        String text =
                """
                Asfarol - Associacao Dos Moradores Do Farol
                Do Lago
                RUA RUA TUCUNARE ESQUINA COM AVENIDA DO FAROL S/N, CONDOMINIO FAROL DO LAGO,
                ABADIANIA, GO, 72940000
                Inadimplência
                R45
                Até: 01/07/2026 - Valores calculados até: 01/07/2026 - Unidade: todas
                Id Histórico Compet. Vencimento Atraso Principal
                QD01-LT01
                593703 TAXA ORDINÁRIA 01/2025 01/25 10/01/25 537 459,01
                Qtd: 1 459,01
                QD01-LT02
                593316 TAXA ORDINÁRIA 08/2025 08/25 10/08/25 325 259,00
                655209 TAXA CONDOMÍNIO REF 06/2026 06/26 10/06/26 21 359,00
                Qtd: 2 618,00
                QD11-LT13
                594117 ACORDO 4/4 06/26 16/06/26 15 1.090,08
                Qtd: 1 1.090,08
                Qtd total: 273 - Total Unidades: 78 111.474,27
                Cobranças em acordo
                QD03-LT05
                593706 TAXA ORDINÁRIA 03/2026 03/26 10/03/26 113 509,01
                Qtd: 1 509,01
                Página 9 de 10\tCondo Id - Condomínios Inteligentes
                """;

        InadimplenciaPdfParser.InadimplenciaPdfParseResult r = InadimplenciaPdfParser.parseText(text);

        assertEquals("01/07/2026", r.dataReferenciaPdf());
        assertTrue(r.condominioNome().contains("Asfarol"));
        assertEquals(3, r.unidades().size());
        assertEquals("QD01-LT01", r.unidades().get(0).codigoUnidade());
        assertEquals(1, r.unidades().get(0).cobrancas().size());
        assertEquals("593703", r.unidades().get(0).cobrancas().getFirst().doc());
        assertEquals("01/2025", r.unidades().get(0).cobrancas().getFirst().periodo());
        assertEquals("10/01/2025", r.unidades().get(0).cobrancas().getFirst().vencimento());
        assertEquals(45901L, r.unidades().get(0).cobrancas().getFirst().valorCentavos());

        InadimplenciaUnidadeDto lt02 = r.unidades().stream()
                .filter(u -> "QD01-LT02".equals(u.codigoUnidade()))
                .findFirst()
                .orElseThrow();
        assertEquals(2, lt02.cobrancas().size());

        InadimplenciaUnidadeDto acordo = r.unidades().stream()
                .filter(u -> "QD11-LT13".equals(u.codigoUnidade()))
                .findFirst()
                .orElseThrow();
        assertEquals("ACORDO 4/4", acordo.cobrancas().getFirst().receita());
        assertEquals(109008L, acordo.cobrancas().getFirst().valorCentavos());

        assertEquals(4, r.resumo().quantidadeCobrancas());
    }

    static boolean pdfCondoIdFarolLagoDisponivel() {
        return java.nio.file.Files.isRegularFile(
                java.nio.file.Path.of("/Users/itamar/Downloads/01-07_0854_INADIMPLÊNCIA - FAROLDOLAGO - CONDO ID.pdf"));
    }

    @Test
    @EnabledIf("br.com.vilareal.condominio.pdf.InadimplenciaPdfParserTest#pdfCondoIdFarolLagoDisponivel")
    void parse_pdfCondoIdFarolLago_extraiResumoEsperado() throws IOException {
        byte[] bytes = java.nio.file.Files.readAllBytes(java.nio.file.Path.of(
                "/Users/itamar/Downloads/01-07_0854_INADIMPLÊNCIA - FAROLDOLAGO - CONDO ID.pdf"));
        InadimplenciaPdfParser.InadimplenciaPdfParseResult r = InadimplenciaPdfParser.parse(bytes);
        assertEquals("01/07/2026", r.dataReferenciaPdf());
        assertEquals(78, r.resumo().quantidadeUnidades());
        assertEquals(273, r.resumo().quantidadeCobrancas());
        assertEquals(11147427L, r.resumo().valorTotalCentavos());
    }

    static boolean pdfEmResourcesDisponivel() {
        try (InputStream in =
                InadimplenciaPdfParserTest.class.getResourceAsStream("/inadimplenciaPorUnidade.pdf")) {
            return in != null;
        } catch (IOException e) {
            return false;
        }
    }

    @Test
    @EnabledIf("br.com.vilareal.condominio.pdf.InadimplenciaPdfParserTest#pdfEmResourcesDisponivel")
    void parse_pdfRealEmResources_extraiAlgumaUnidade() throws IOException {
        byte[] bytes;
        try (InputStream in =
                InadimplenciaPdfParserTest.class.getResourceAsStream("/inadimplenciaPorUnidade.pdf")) {
            assumeTrue(in != null);
            bytes = in.readAllBytes();
        }
        String bruto = InadimplenciaPdfParser.extrairTextoBruto(bytes);
        assumeTrue(!bruto.isBlank(), "PDF vazio");
        InadimplenciaPdfParser.InadimplenciaPdfParseResult r = InadimplenciaPdfParser.parse(bytes);
        assertTrue(
                r.resumo().quantidadeUnidades() > 0,
                "Esperado ao menos 1 unidade no PDF real; texto (500 chars): "
                        + bruto.substring(0, Math.min(500, bruto.length())));
    }
}
