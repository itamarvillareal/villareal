package br.com.vilareal.documento;

import br.com.vilareal.documento.parse.DocumentoDocxParser;
import br.com.vilareal.documento.parse.DocumentoParseado;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoReformatarFluxoDocxTest {
    private static final Path DOCX = Path.of(
            System.getProperty("user.home"),
            "Downloads",
            "Pedido_Ajuste_Saneamento_art357p1_6003951-79.docx");

    @EnabledIf("docxDisponivel")
    @Test
    void fluxoPreview_usaModoEstruturado_naoCorpoUnicoNoPdf() throws Exception {
        DocumentoDocxParser parser = new DocumentoDocxParser();
        DocumentoParseado parsed;
        try (var in = Files.newInputStream(DOCX)) {
            parsed = parser.parsear(in);
        }

        DocumentoReformatarConteudoRequest base = new DocumentoReformatarConteudoRequest(
                "MERITÍSSIMO JUÍZO DA 3ª VARA CÍVEL DA COMARCA DE ANÁPOLIS - GO",
                parsed.numeroProcesso(),
                "Anápolis, estado de Goiás, 23 de julho de 2026",
                "2026-07-23",
                parsed.nomePeca(),
                "<p>preâmbulo teste</p>",
                java.util.List.of(),
                "",
                null,
                null,
                null,
                null);

        String corpoUnico = DocumentoReformatarCorpoUnicoHtml.montar(base);
        assertThat(corpoUnico).contains("data-doc-part=\"cabecalho\"");
        assertThat(corpoUnico).contains("data-doc-part=\"preambulo\"");

        DocumentoReformatarConteudoRequest parsedCorpo =
                DocumentoReformatarCorpoUnicoHtml.aplicarCorpoUnico(base, corpoUnico);

        assertThat(parsedCorpo.preambulo()).contains("preâmbulo teste");
        assertThat(parsedCorpo.enderecamento()).contains("MERITÍSSIMO");

        String pdfHtml = DocumentoReformatarCorpoUnicoHtml.extrairHtmlParaPdf(corpoUnico);
        assertThat(pdfHtml).doesNotContain("data:image");
        assertThat(pdfHtml).doesNotContain("data-doc-part=\"cabecalho\"");
    }

    static boolean docxDisponivel() {
        return Files.isRegularFile(DOCX);
    }
}
