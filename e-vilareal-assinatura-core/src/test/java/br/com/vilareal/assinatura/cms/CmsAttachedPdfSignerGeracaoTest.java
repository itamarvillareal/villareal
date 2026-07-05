package br.com.vilareal.assinatura.cms;

import br.com.vilareal.assinatura.keystore.AssinaturaKeyMaterial;
import br.com.vilareal.assinatura.keystore.Pkcs12KeyMaterialProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Prova que {@link CmsAttachedPdfSigner} reproduz o gabarito CMS do tribunal (sem token).
 * Usa PKCS#12 autoassinado sintético — não envolve certificado ICP-Brasil real.
 */
class CmsAttachedPdfSignerGeracaoTest {

    private static final int PDF_CANONICO_BYTES = 1483;
    private static final char[] P12_PASSWORD = "test-fixture".toCharArray();

    @TempDir
    Path tempDir;

    @Test
    void pkcs12_autoassinado_geraP7sComGabaritoDoTribunal() throws Exception {
        byte[] pdf = carregarFixture("referencia-sintetica.pdf");
        byte[] referenciaP7s = carregarFixture("referencia-sintetica.p7s");
        Path p12 = materializarP12Fixture();

        assertThat(pdf).hasSize(PDF_CANONICO_BYTES);

        CmsStructureReport referencia = CmsStructureInspector.inspecionar(referenciaP7s);
        assertThat(CmsStructureInspector.validarContraSpecTribunal(referencia)).isEmpty();

        try (Pkcs12KeyMaterialProvider provider = new Pkcs12KeyMaterialProvider(p12, P12_PASSWORD)) {
            AssinaturaKeyMaterial material = provider.load();
            byte[] geradoP7s = CmsAttachedPdfSigner.assinar(pdf, material);

            CmsStructureReport gerado = CmsStructureInspector.inspecionar(geradoP7s);

            assertThat(gerado.embeddedPdf())
                    .as("PDF embutido deve ser byte-idêntico ao input")
                    .isEqualTo(pdf);
            assertThat(CmsStructureInspector.validarGabaritoGeracao(gerado))
                    .as("estrutura CMS gerada deve atender o gabarito do tribunal")
                    .isEmpty();
            assertThat(CmsStructureInspector.compararGabaritoGeracaoComReferencia(referencia, gerado))
                    .as("campos invariantes devem coincidir com referencia-sintetica.p7s")
                    .isEmpty();
        }
    }

    private Path materializarP12Fixture() throws Exception {
        Path destino = tempDir.resolve("test-signer.p12");
        try (InputStream in = getClass().getResourceAsStream("/assinatura/test-signer.p12")) {
            if (in == null) {
                throw new IllegalStateException("Fixture ausente: /assinatura/test-signer.p12");
            }
            Files.write(destino, in.readAllBytes());
        }
        return destino;
    }

    private static byte[] carregarFixture(String nome) throws Exception {
        try (InputStream in = CmsAttachedPdfSignerGeracaoTest.class.getResourceAsStream("/assinatura/" + nome)) {
            if (in == null) {
                throw new IllegalStateException("Fixture ausente: /assinatura/" + nome);
            }
            return in.readAllBytes();
        }
    }
}
