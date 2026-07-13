package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Manual (requer banco local para subir o contexto — não roda no CI):
 * {@code ./mvnw test -Dtest=DocumentoPdfServicePeticaoManualTest -Dvilareal.documento.manual=true}
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@EnabledIfSystemProperty(named = "vilareal.documento.manual", matches = "true")
class DocumentoPdfServicePeticaoManualTest {

    @Autowired
    private DocumentoPdfService pdfService;

    @Test
    void gerarPeticaoPdf_enderecamentoComOrdinalJuizado() {
        DocumentoGerarRequest request = new DocumentoGerarRequest(
                "MERITÍSSIMO JUÍZO DO 1º JUIZADO ESPECIAL CÍVEL DA COMARCA DE ANÁPOLIS - GO",
                "5589985-77.2026.8.09.0007",
                "<p>CONDOMINIO TERRA MUNDI ANÁPOLIS, já devidamente qualificado(s), vem, respeitosamente, "
                        + "perante Vossa Excelência, na ação que move em face de J.J.A CONCRETOS LTDA, "
                        + "já devidamente qualificado(s), requerer o que segue.</p>",
                List.of(new DocumentoGerarRequest.SecaoPeticao("DOS FATOS", "<p>Fatos do caso.</p>")),
                List.of("Deferimento."),
                "Anápolis, estado de Goiás",
                LocalDate.of(2026, 6, 29),
                null);

        byte[] pdf = pdfService.gerarPeticaoPdf(request);

        assertThat(pdf).isNotNull();
        assertThat(pdf.length).isGreaterThan(500);
        assertThat(new String(pdf, 0, Math.min(5, pdf.length))).startsWith("%PDF");
    }
}
