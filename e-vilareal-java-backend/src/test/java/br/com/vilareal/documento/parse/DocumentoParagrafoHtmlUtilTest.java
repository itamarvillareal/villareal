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
    void paragrafoToHtml_preservaEstiloRecuo() {
        ParagrafoDocumento p = new ParagrafoDocumento(
                TipoParagrafo.CORPO,
                List.of(new TextoFormatado("Texto recuado.", false, false, false)),
                "text-align: justify; text-indent: 2.50cm;");

        String html = DocumentoParagrafoHtmlUtil.paragrafoToHtml(p);

        assertThat(html).contains("style=\"text-align: justify; text-indent: 2.50cm;\"");
        assertThat(html).contains("class=\"corpo\"");
    }

    @Test
    void htmlToParagrafos_restauraEstiloRecuo() {
        List<ParagrafoDocumento> paragrafos = DocumentoParagrafoHtmlUtil.htmlToParagrafos(
                "<p class=\"corpo\" style=\"text-indent: 2.50cm; text-align: justify;\">Parágrafo recuado.</p>",
                TipoParagrafo.CORPO);

        assertThat(paragrafos).hasSize(1);
        assertThat(paragrafos.get(0).estiloCss()).contains("text-indent: 2.50cm");
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
    void normalizarHtmlLegadoCorpo_brSeguidoDeTexto() {
        String html = DocumentoParagrafoHtmlUtil.normalizarHtmlLegadoCorpo(
                "<br>Embora tenha sido o processo extinto por sentença.");

        assertThat(html).contains("Embora tenha sido");
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

    @Test
    void roundTrip_tabelaHtml() {
        String html =
                "<p class=\"corpo\">Texto introdutório.</p>"
                        + "<table class=\"doc-tabela\"><tr><th>Parcela</th><th>Valor</th></tr>"
                        + "<tr><td>Entrada</td><td>4.748,71</td></tr></table>";

        List<ParagrafoDocumento> paragrafos = DocumentoParagrafoHtmlUtil.htmlToParagrafos(html, TipoParagrafo.CORPO);

        assertThat(paragrafos).hasSize(2);
        assertThat(paragrafos.get(1).tipo()).isEqualTo(TipoParagrafo.TABELA);
        assertThat(paragrafos.get(1).textoPlano()).contains("4.748,71");

        String roundTrip = DocumentoParagrafoHtmlUtil.paragrafosToHtml(paragrafos);
        assertThat(roundTrip).contains("<table class=\"doc-tabela\">");
        assertThat(roundTrip).contains("4.748,71");
    }
}
