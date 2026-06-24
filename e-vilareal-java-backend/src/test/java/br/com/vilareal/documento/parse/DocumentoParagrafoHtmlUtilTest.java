package br.com.vilareal.documento.parse;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoParagrafoHtmlUtilTest {

    @Test
    void paragrafoToHtml_preservaNegrito() {
        ParagrafoDocumento p = new ParagrafoDocumento(
                TipoParagrafo.CORPO,
                List.of(
                        new TextoFormatado("Fulano, ", false, false, false),
                        new TextoFormatado("brasileiro", true, false, false)));

        String html = DocumentoParagrafoHtmlUtil.paragrafoToHtml(p);

        assertThat(html).contains("<strong>brasileiro</strong>");
    }

    @Test
    void htmlToParagrafos_restauraNegrito() {
        List<ParagrafoDocumento> paragrafos = DocumentoParagrafoHtmlUtil.htmlToParagrafos(
                "<p class=\"corpo\">Fulano, <strong>brasileiro</strong></p>", TipoParagrafo.CORPO);

        assertThat(paragrafos).hasSize(1);
        assertThat(paragrafos.get(0).conteudo()).anyMatch(t -> t.negrito() && t.texto().contains("brasileiro"));
    }

    @Test
    void normalizarHtmlLegadoCorpo_textoPlanoComQuebrasDeLinha() {
        String html = DocumentoParagrafoHtmlUtil.normalizarHtmlLegadoCorpo(
                "Primeiro parágrafo.\n\nSegundo parágrafo.");

        assertThat(html).contains("<p class=\"corpo\">Primeiro parágrafo.</p>");
        assertThat(html).contains("<p class=\"corpo\">Segundo parágrafo.</p>");
    }

    @Test
    void normalizarHtmlLegadoCorpo_paragrafoHtmlSemClasse() {
        String html = DocumentoParagrafoHtmlUtil.normalizarHtmlLegadoCorpo(
                "<p>Texto sem classe.</p>");

        assertThat(html).isEqualTo("<p class=\"corpo\">Texto sem classe.</p>");
    }

    @Test
    void normalizarHtmlLegadoCorpo_preservaCitacaoSublinhadoDestacado() {
        String html = DocumentoParagrafoHtmlUtil.normalizarHtmlLegadoCorpo(
                "<p>Parágrafo com <u>sublinhado</u> e <mark>destaque</mark>.</p>"
                        + "<p class=\"citacao\">Art. 239 do CPC.</p>");

        assertThat(html).contains("<u>sublinhado</u>");
        assertThat(html).contains("<mark>destaque</mark>");
        assertThat(html).contains("<p class=\"citacao\">Art. 239 do CPC.</p>");
    }

    @Test
    void roundTrip_paragrafosToHtml_e_htmlToParagrafos() {
        List<ParagrafoDocumento> originais = List.of(
                new ParagrafoDocumento(TipoParagrafo.ENUMERACAO, List.of(new TextoFormatado("a) item", false, false, false))),
                new ParagrafoDocumento(TipoParagrafo.CORPO, List.of(new TextoFormatado("Texto comum", false, false, false))));

        String html = DocumentoParagrafoHtmlUtil.paragrafosToHtml(originais);
        List<ParagrafoDocumento> restaurados = DocumentoParagrafoHtmlUtil.htmlToParagrafos(html, TipoParagrafo.CORPO);

        assertThat(restaurados).hasSize(2);
        assertThat(restaurados.get(0).tipo()).isEqualTo(TipoParagrafo.ENUMERACAO);
        assertThat(restaurados.get(0).textoPlano()).contains("a) item");
        assertThat(restaurados.get(1).textoPlano()).contains("Texto comum");
    }
}
