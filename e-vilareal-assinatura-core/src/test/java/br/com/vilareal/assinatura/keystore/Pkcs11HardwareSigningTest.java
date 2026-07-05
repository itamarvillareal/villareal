package br.com.vilareal.assinatura.keystore;

import br.com.vilareal.assinatura.cms.CmsAttachedPdfSigner;
import br.com.vilareal.assinatura.cms.CmsCadeiaEmbutidaInspector;
import br.com.vilareal.assinatura.cms.CmsCadeiaEmbutidaInspector.CadeiaEmbutidaReport;
import br.com.vilareal.assinatura.cms.CmsStructureInspector;
import br.com.vilareal.assinatura.cms.CmsStructureReport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Testes com token A3 real (SafeSign/Soluti). Executar somente no Windows com token plugado.
 *
 * <p>Ver {@code docs/WINDOWS-PKCS11-TEST.md} para passo-a-passo.
 */
@Tag("pkcs11-hardware")
@EnabledOnOs(OS.WINDOWS)
@EnabledIfEnvironmentVariable(named = "ASSINATURA_TOKEN_PIN", matches = ".+")
class Pkcs11HardwareSigningTest {

    private static final int PDF_CANONICO_BYTES = 1483;

    private Pkcs11KeyMaterialProvider provider;

    @BeforeEach
    void abrirSessaoToken() throws Exception {
        provider = Pkcs11KeyMaterialProvider.fromEnvironment();
        provider.open();
    }

    @AfterEach
    void fecharSessaoToken() {
        if (provider != null) {
            provider.close();
        }
    }

    @Test
    void token_geraCadeiaIcpEmbutidaNaOrdemCorreta() throws Exception {
        byte[] pdf = carregarFixture("referencia-sintetica.pdf");
        assertThat(pdf).hasSize(PDF_CANONICO_BYTES);

        AssinaturaKeyMaterial material = provider.load();
        byte[] geradoP7s = CmsAttachedPdfSigner.assinar(pdf, material);

        CadeiaEmbutidaReport cadeia = CmsCadeiaEmbutidaInspector.inspecionar(geradoP7s);
        assertThat(cadeia.valida())
                .as("cadeia embutida: %s", cadeia.erros())
                .isTrue();
        assertThat(cadeia.quantidade()).isEqualTo(4);

        byte[] referenciaP7s = carregarFixture("referencia-sintetica.p7s");
        var issuersReferencia = CmsCadeiaEmbutidaInspector.extrairIssuersReferencia(referenciaP7s);
        assertThat(CmsCadeiaEmbutidaInspector.compararIssuersComReferencia(
                        issuersReferencia, cadeia.issuersOrdenados()))
                .isEmpty();
    }

    @Test
    void token_geraP7sEstruturalmenteIdenticoAoTribunal() throws Exception {
        byte[] pdf = carregarFixture("referencia-sintetica.pdf");
        byte[] referenciaP7s = carregarFixture("referencia-sintetica.p7s");

        AssinaturaKeyMaterial material = provider.load();
        byte[] geradoP7s = CmsAttachedPdfSigner.assinar(pdf, material);

        CmsStructureReport referencia = CmsStructureInspector.inspecionar(referenciaP7s);
        CmsStructureReport gerado = CmsStructureInspector.inspecionar(geradoP7s);

        assertThat(gerado.embeddedPdf()).isEqualTo(pdf);
        assertThat(CmsStructureInspector.validarContraSpecTribunal(gerado)).isEmpty();
        assertThat(CmsStructureInspector.compararComReferenciaTribunal(referencia, gerado))
                .as("estrutura deve coincidir com referencia-sintetica.p7s (exceto signingTime/valor RSA)")
                .isEmpty();
    }

    private static byte[] carregarFixture(String nome) throws Exception {
        try (InputStream in = Pkcs11HardwareSigningTest.class.getResourceAsStream("/assinatura/" + nome)) {
            if (in == null) {
                throw new IllegalStateException("Fixture ausente: /assinatura/" + nome);
            }
            return in.readAllBytes();
        }
    }
}
