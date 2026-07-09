package br.com.vilareal.documento;

import br.com.vilareal.documento.tema.TemaDocumento;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoReformatarCorpoUnicoHtmlTest {

    @Test
    void montar_e_aplicarCorpoUnico_preservaCabecalhoEnderecamentoESecoes() {
        DocumentoReformatarConteudoRequest original = new DocumentoReformatarConteudoRequest(
                "MERITÍSSIMO JUÍZO DA 1ª VARA",
                "0000605-44.2026.5.18.0054",
                "Anápolis, estado de Goiás",
                "2026-06-03",
                "IMPUGNAÇÃO À CONTESTAÇÃO",
                "<p class=\"corpo\">SILVIA MARIA, vem impugnar.</p>",
                List.of(new DocumentoReformatarConteudoRequest.SecaoConteudo(
                        "I - BREVE SÍNTESE", "SUB", "<p class=\"corpo\">Síntese do caso.</p>")),
                "",
                DocumentoReformatarCorpoUnicoHtml.ADVOGADO_NOME_PADRAO,
                "OAB/GO 33.329",
                null,
                null);

        String html = DocumentoReformatarCorpoUnicoHtml.montar(original);
        assertThat(html).contains("data-doc-part=\"cabecalho\"");
        assertThat(html).contains("data-doc-part=\"enderecamento\"");
        assertThat(html).contains("MERITÍSSIMO JUÍZO DA 1ª VARA");
        assertThat(html).contains("data-doc-part=\"advogado-oab\"");

        DocumentoReformatarConteudoRequest editado = DocumentoReformatarCorpoUnicoHtml.aplicarCorpoUnico(
                original,
                html.replace("OAB/GO 33.329", "OAB/GO 33.330")
                        .replace("1ª VARA", "2ª VARA"));

        assertThat(editado.advogadoOab()).contains("33.330");
        assertThat(editado.enderecamento()).contains("2ª VARA");
        assertThat(editado.numeroProcesso()).isEqualTo("0000605-44.2026.5.18.0054");
        assertThat(editado.secoes()).hasSize(1);
        assertThat(editado.secoes().get(0).titulo()).contains("BREVE SÍNTESE");
    }

    @Test
    void extrairHtmlParaPdf_removeCabecalhoSemDuplicarTitulo() {
        DocumentoReformatarConteudoRequest original = new DocumentoReformatarConteudoRequest(
                "MERITÍSSIMO JUÍZO",
                "0000605-44.2026.5.18.0054",
                "Anápolis, estado de Goiás",
                "2026-06-03",
                "",
                "<p class=\"corpo\">SILVIA MARIA, vem impugnar.</p>"
                        + "<p style=\"text-align:center;font-weight:bold\">IMPUGNAÇÃO À CONTESTAÇÃO (RÉPLICA)</p>"
                        + "<p class=\"corpo\">pelas razões...</p>",
                List.of(new DocumentoReformatarConteudoRequest.SecaoConteudo(
                        "I - BREVE SÍNTESE", "SUB", "<p class=\"corpo\">Texto da seção.</p>")),
                "",
                null,
                null,
                null,
                null);

        String html = DocumentoReformatarCorpoUnicoHtml.montar(original);
        String pdfHtml = DocumentoReformatarCorpoUnicoHtml.extrairHtmlParaPdf(html);

        assertThat(pdfHtml).doesNotContain("data-doc-part=\"cabecalho\"");
        assertThat(pdfHtml).doesNotContain("data-doc-part=\"assinatura\"");
        assertThat(pdfHtml).doesNotContain("data-doc-part=\"local-data\"");
        assertThat(pdfHtml).doesNotContain("OAB/GO");
        assertThat(pdfHtml).contains("IMPUGNAÇÃO À CONTESTAÇÃO (RÉPLICA)");
        assertThat(pdfHtml).doesNotContain("data-doc-part=\"nome-peca\"");
        assertThat(pdfHtml.split("IMPUGNAÇÃO À CONTESTAÇÃO \\(RÉPLICA\\)", -1)).hasSize(2);

        String local = DocumentoReformatarCorpoUnicoHtml.extrairLocalData(html);
        assertThat(local).contains("Anápolis");
    }

    @Test
    void extrairLocalData_encontraLinhaSemDataDocPart() {
        String html =
                """
                <div class="doc-edicao-preview">
                <div data-doc-part="fecho"><p>pede deferimento.</p></div>
                <p style="text-align:center">ANÁPOLIS, estado de Goiás.</p>
                <div data-doc-part="assinatura"><p>Dr. ITAMAR</p><p>OAB/GO 33.329</p></div>
                </div>
                """;
        assertThat(DocumentoReformatarCorpoUnicoHtml.extrairLocalData(html))
                .containsIgnoringCase("anápolis");
    }

    @Test
    void montar_usaLogoEAssinaturaDoTemaQuandoInformado() {
        TemaDocumento karla = TemaDocumento.personalizado(
                "modelo.2",
                null,
                "data:image/png;base64,QUJD",
                null,
                null,
                "Karla Caroline Pedroza Silva",
                "OAB/GO 41.662");
        DocumentoReformatarConteudoRequest req = new DocumentoReformatarConteudoRequest(
                "MERITÍSSIMO JUÍZO",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);

        String html = DocumentoReformatarCorpoUnicoHtml.montar(req, karla);

        assertThat(html).contains("data:image/png;base64,QUJD");
        assertThat(html).contains("Karla Caroline Pedroza Silva");
        assertThat(html).contains("OAB/GO 41.662");
        assertThat(html).doesNotContain("Itamar Alexandre");
    }

    @Test
    void sanitizarHtmlParaPdf_converteBrParaXhtml() {
        String xhtml = DocumentoReformatarCorpoUnicoHtml.sanitizarHtmlParaPdf(
                "<p>Linha 1<br>Linha 2</p><img src=\"x.png\" alt=\"logo\">");
        assertThat(xhtml).contains("<br />");
        assertThat(xhtml).doesNotContain("<br>");
        assertThat(xhtml).contains("<img src=\"x.png\" alt=\"logo\" />");
    }
}
