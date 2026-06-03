package br.com.vilareal.documento;

import br.com.vilareal.documento.parse.DocumentoDocxParser;
import br.com.vilareal.documento.parse.DocumentoLocalDataResolver;
import br.com.vilareal.documento.parse.DocumentoParseado;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoLocalDataResolverTest {

    private static final Path ARQUIVO_IMPUGNACAO = Path.of(
            System.getProperty("user.home"), "Downloads", "Impugnacao_Mov336_MariaEdna.docx");

    private final DocumentoPdfService pdfService = new DocumentoPdfService(null);

    @Test
    void formularioComDataCompletaPrevaleceSobrePlaceholderDoDocx() {
        String doc = "Anápolis, estado de Goiás, ____ de junho de 2026.";
        String form = "Anápolis, estado de Goiás, 01 de junho de 2026";

        String local = DocumentoLocalDataResolver.resolver(form, "2026-06-01", doc, pdfService);

        assertThat(local).isEqualTo("Anápolis, estado de Goiás, 01 de junho de 2026.");
    }

    @Test
    void apenasCidadeNoFormularioMontaDataPeloIso() {
        String local = DocumentoLocalDataResolver.resolver(
                "Anápolis, estado de Goiás", "2026-06-01", null, pdfService);

        assertThat(local).isEqualTo("Anápolis, estado de Goiás, 1 de junho de 2026.");
    }

    @Test
    void documentoComPlaceholderUsaFormularioOuDataIso() {
        String doc = "Anápolis, estado de Goiás, ____ de junho de 2026.";

        String local = DocumentoLocalDataResolver.resolver(
                "Anápolis, estado de Goiás", "2026-06-01", doc, pdfService);

        assertThat(local).isEqualTo("Anápolis, estado de Goiás, 1 de junho de 2026.");
    }

    @EnabledIf("arquivoImpugnacaoDisponivel")
    @Test
    void docxImpugnacao_formularioSobrescreveDataEmBranco() throws Exception {
        DocumentoDocxParser parser = new DocumentoDocxParser();
        DocumentoParseado parseado;
        try (var in = Files.newInputStream(ARQUIVO_IMPUGNACAO)) {
            parseado = parser.parsear(in);
        }

        assertThat(parseado.localData()).contains("____");

        String form = "Anápolis, estado de Goiás, 01 de junho de 2026";
        String local = DocumentoLocalDataResolver.resolver(form, "2026-06-01", parseado.localData(), pdfService);

        assertThat(local).isEqualTo("Anápolis, estado de Goiás, 01 de junho de 2026.");
    }

    static boolean arquivoImpugnacaoDisponivel() {
        return Files.isRegularFile(ARQUIVO_IMPUGNACAO);
    }
}
