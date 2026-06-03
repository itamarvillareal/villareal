package br.com.vilareal.julia.application;

import br.com.vilareal.projudi.ProjudiDriveMovimentacoesPdfSupport;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JuliaTriagemContextoDriveServiceTest {

    @Test
    void termosRelevancia_incluiAudienciaECertidao() {
        List<String> termos =
                JuliaTriagemContextoDriveService.termosRelevancia(null, "PROJUDI informa intimação — audiência designada");
        assertThat(termos).contains("audi");
        assertThat(termos).contains("intima");
    }

    @Test
    void selecionarDocumentos_incluiUltimasEMatchPorNome() {
        var svc = new JuliaTriagemContextoDriveService(null, null, 8, 5000, 20000);
        List<ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive> catalogo = List.of(
                new ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive("f39", "0039 Movimentação - Arquivo 01 - Despacho.pdf", 39, 1),
                new ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive("f40", "0040 Movimentação - Arquivo 01 - Intimação.pdf", 40, 1),
                new ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive(
                        "f41", "0041 Movimentação - Arquivo 01 - Certidão Audiência.pdf", 41, 1));

        var sel = svc.selecionarDocumentosParaTriagem(catalogo, null, "certidão de audiência designada");

        assertThat(sel).extracting(ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive::fileId)
                .contains("f41", "f40", "f39");
    }
}
