package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContratoLocacaoNegritoUtilTest {

    @Test
    void aplicarNegritoNomesCompletos_destacaMaiusculasEProperCase() {
        String html = ContratoLocacaoDocumentoService.textoProcessadoParaHtml(
                "como LOCADOR, ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR, Itamar Alexandre Felix Villa Real Junior, brasileiro");

        String out = ContratoLocacaoNegritoUtil.aplicarNegritoNomesCompletos(
                html, "Itamar Alexandre Felix Villa Real Junior");

        assertThat(out).contains("<strong>ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR</strong>");
        assertThat(out).contains("<strong>Itamar Alexandre Felix Villa Real Junior</strong>");
    }
}
