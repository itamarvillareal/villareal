package br.com.vilareal.assinatura.cms;

import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;

class CmsStructureInspectorReferenciaTest {

    private static final int PDF_CANONICO_BYTES = 1483;

    @Test
    void referenciaSintetica_atendeSpecTribunal() throws Exception {
        byte[] p7s = carregarFixture("referencia-sintetica.p7s");

        CmsStructureReport report = CmsStructureInspector.inspecionar(p7s);

        assertThat(report.cmsValido()).isTrue();
        assertThat(CmsStructureInspector.validarContraSpecTribunal(report)).isEmpty();
    }

    @Test
    void referenciaSintetica_pdfEmbutidoByteIdenticoAoFixture() throws Exception {
        byte[] pdf = carregarFixture("referencia-sintetica.pdf");
        byte[] p7s = carregarFixture("referencia-sintetica.p7s");

        assertThat(pdf).hasSize(PDF_CANONICO_BYTES);

        CmsStructureReport report = CmsStructureInspector.inspecionar(p7s);
        assertThat(report.embeddedPdf()).isEqualTo(pdf);
    }

    private static byte[] carregarFixture(String nome) throws Exception {
        try (InputStream in =
                CmsStructureInspectorReferenciaTest.class.getResourceAsStream("/assinatura/" + nome)) {
            if (in == null) {
                throw new IllegalStateException("Fixture ausente: /assinatura/" + nome);
            }
            return in.readAllBytes();
        }
    }
}
