package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TopicoChaveLocacaoUtilTest {

    @Test
    void montarChave_prefixaContratosLocacao() {
        assertThat(TopicoChaveLocacaoUtil.montarChave("COM CAUÇÃO")).isEqualTo("CONTRATOS=LOCAÇÃO=COM CAUÇÃO");
    }

    @Test
    void textoProcessadoParaHtml_escapaCaracteresHtml() {
        assertThat(ContratoLocacaoDocumentoService.textoProcessadoParaHtml("A & B <teste>"))
                .isEqualTo("A &amp; B &lt;teste&gt;");
    }

    @Test
    void textoProcessadoParaHtml_converteQuebrasParaLinhasJustificaveis() {
        assertThat(ContratoLocacaoDocumentoService.textoProcessadoParaHtml("a) item\nb) item"))
                .isEqualTo(
                        "<span class=\"contrato-linha\">a) item</span>"
                                + "<span class=\"contrato-linha\">b) item</span>");
        assertThat(ContratoLocacaoDocumentoService.textoProcessadoParaHtml("a) item\n\nb) item"))
                .isEqualTo(
                        "<span class=\"contrato-linha\">a) item</span>"
                                + "<span class=\"contrato-linha\">b) item</span>");
    }

    @Test
    void textoProcessadoParaHtml_linkVistoriaEmAzul() {
        String url = "https://www.dropbox.com/scl/fo/abc/test?rlkey=xyz&dl=0";
        String urlHtml = "https://www.dropbox.com/scl/fo/abc/test?rlkey=xyz&amp;dl=0";
        assertThat(ContratoLocacaoDocumentoService.textoProcessadoParaHtml(
                        "Parágrafo único: fotos disponíveis no link " + url))
                .isEqualTo(
                        "Parágrafo único: fotos disponíveis no link <a href=\""
                                + urlHtml
                                + "\" class=\"contrato-link\">"
                                + urlHtml
                                + "</a>");
    }
}
