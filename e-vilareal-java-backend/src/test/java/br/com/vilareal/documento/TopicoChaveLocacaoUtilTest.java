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
}
