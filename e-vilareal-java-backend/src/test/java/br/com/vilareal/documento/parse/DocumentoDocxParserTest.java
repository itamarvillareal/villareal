package br.com.vilareal.documento.parse;

import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
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
}
