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
    void montarCorpoClausulaHtml_caputNaMesmaLinhaParagrafosEmBloco() {
        String caput = "O prazo da locação é de 6 meses, iniciando no dia 30 de maio de 2025.";
        String par1 = "§1º Terminado o prazo inicialmente convencionado.";
        String par2 = "§2º Caso o Locatário não conceda o aviso prévio.";

        String html = ContratoLocacaoDocumentoService.montarCorpoClausulaHtml(caput + "\n" + par1 + "\n" + par2);

        assertThat(html).startsWith(caput);
        assertThat(html).doesNotStartWith("<span class=\"contrato-linha\">" + caput);
        assertThat(html).contains("<span class=\"contrato-linha\">§1º Terminado");
        assertThat(html).contains("<span class=\"contrato-linha\">§2º Caso");
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
