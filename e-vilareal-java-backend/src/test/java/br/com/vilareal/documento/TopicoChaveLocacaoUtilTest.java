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
    void textoProcessadoParaHtml_preservaQuebraSimplesSemBr() {
        assertThat(ContratoLocacaoDocumentoService.textoProcessadoParaHtml("a) item\nb) item"))
                .isEqualTo("a) item\nb) item");
        assertThat(ContratoLocacaoDocumentoService.textoProcessadoParaHtml("a) item\n\nb) item"))
                .isEqualTo("a) item\nb) item");
    }

    @Test
    void textoProcessadoParaHtml_linkVistoriaEmAzul() {
        assertThat(ContratoLocacaoDocumentoService.textoProcessadoParaHtml(
                        "Link: https://exemplo.com/vistoria/123"))
                .isEqualTo(
                        "Link: <a href=\"https://exemplo.com/vistoria/123\" class=\"contrato-link\">https://exemplo.com/vistoria/123</a>");
    }
}
