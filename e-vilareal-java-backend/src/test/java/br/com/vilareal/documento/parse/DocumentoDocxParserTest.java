package br.com.vilareal.documento.parse;

import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoDocxParserTest {

    private final DocumentoDocxParser parser = new DocumentoDocxParser();

    @Test
    void parsear_extraiEnderecamentoJustificadoSemDuplicarNoPreambulo() {
        try (XWPFDocument doc = new XWPFDocument()) {
            XWPFParagraph end = doc.createParagraph();
            end.setAlignment(ParagraphAlignment.BOTH);
            XWPFRun rEnd = end.createRun();
            rEnd.setBold(true);
            rEnd.setText(
                    "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DO 3º JUIZADO ESPECIAL CÍVEL DA COMARCA DE ANÁPOLIS – ESTADO DE GOIÁS");

            XWPFParagraph proc = doc.createParagraph();
            proc.setAlignment(ParagraphAlignment.RIGHT);
            proc.createRun().setText("Autos nº 5009686-73.2026.8.09.0007");

            XWPFParagraph pre = doc.createParagraph();
            pre.setAlignment(ParagraphAlignment.BOTH);
            pre.createRun().setText("ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR, vem apresentar a presente.");

            XWPFParagraph titulo = doc.createParagraph();
            titulo.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun rTitulo = titulo.createRun();
            rTitulo.setBold(true);
            rTitulo.setText("JUSTIFICATIVA DE AUSÊNCIA EM AUDIÊNCIA");

            DocumentoParseado r = parser.parsear(doc);

            assertThat(r.enderecoJuizo()).contains("EXCELENTÍSSIMO");
            assertThat(r.numeroProcesso()).isEqualTo("5009686-73.2026.8.09.0007");
            assertThat(r.nomePeca()).isEqualTo("JUSTIFICATIVA DE AUSÊNCIA EM AUDIÊNCIA");
            assertThat(r.preambulo()).hasSize(2);
            assertThat(r.preambulo().get(0).textoPlano()).contains("ITAMAR ALEXANDRE");
            assertThat(r.preambulo().get(1).tipo()).isEqualTo(TipoParagrafo.NOME_PECA);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void parsear_extraiTabelaNaSecaoCorrespondente() {
        try (XWPFDocument doc = new XWPFDocument()) {
            XWPFParagraph end = doc.createParagraph();
            end.createRun()
                    .setText(
                            "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA COMARCA DE ANÁPOLIS – ESTADO DE GOIÁS");

            XWPFParagraph titulo = doc.createParagraph();
            XWPFRun rTitulo = titulo.createRun();
            rTitulo.setBold(true);
            rTitulo.setText("III – DO VALOR DEVIDO");

            XWPFParagraph corpo = doc.createParagraph();
            corpo.createRun().setText("O executado propõe o pagamento conforme cronograma abaixo.");

            XWPFTable table = doc.createTable(2, 3);
            preencherCelula(table.getRow(0).getCell(0), "Parcela");
            preencherCelula(table.getRow(0).getCell(1), "Vencimento");
            preencherCelula(table.getRow(0).getCell(2), "Valor (R$)");
            preencherCelula(table.getRow(1).getCell(0), "Entrada");
            preencherCelula(table.getRow(1).getCell(1), "até 5 dias");
            preencherCelula(table.getRow(1).getCell(2), "4.748,71");

            DocumentoParseado r = parser.parsear(doc);

            assertThat(r.secoes()).hasSize(1);
            assertThat(r.secoes().get(0).titulo()).contains("III");
            assertThat(r.secoes().get(0).paragrafos()).anyMatch(p -> p.tipo() == TipoParagrafo.TABELA);
            assertThat(r.secoes().get(0).paragrafos().stream()
                            .filter(p -> p.tipo() == TipoParagrafo.TABELA)
                            .findFirst()
                            .orElseThrow()
                            .textoPlano())
                    .contains("Parcela")
                    .contains("4.748,71");
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static void preencherCelula(XWPFTableCell cell, String texto) {
        XWPFParagraph p = cell.getParagraphs().get(0);
        p.createRun().setText(texto);
    }
}
