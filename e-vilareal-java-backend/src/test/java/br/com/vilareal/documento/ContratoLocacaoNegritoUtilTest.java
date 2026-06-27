package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContratoLocacaoNegritoUtilTest {

    @Test
    void aplicarNegritoNomesCompletos_destacaApenasUmaVariantePorNome() {
        String html = ContratoLocacaoDocumentoService.textoProcessadoParaHtml(
                "como LOCADOR, ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR, brasileiro");

        String out = ContratoLocacaoNegritoUtil.aplicarNegritoNomesCompletos(
                html, "Itamar Alexandre Felix Villa Real Junior");

        assertThat(out).contains("<strong>ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR</strong>");
        assertThat(out).doesNotContain("<strong>Itamar Alexandre Felix Villa Real Junior</strong>");
    }

    @Test
    void aplicarNegritoNomesCompletos_converteProperCaseParaMaiusculasNegrito() {
        String html = ContratoLocacaoDocumentoService.textoProcessadoParaHtml(
                "como LOCATÁRIOS, Carlos Ricardo de Carvalho Reimer, brasileiro, e "
                        + "Globo Comercio, Construções e Serviços Eireli, pessoa jurídica");

        String out = ContratoLocacaoNegritoUtil.aplicarNegritoNomesCompletos(
                html, "Carlos Ricardo de Carvalho Reimer", "Globo Comercio, Construções e Serviços Eireli");

        assertThat(out).contains("<strong>CARLOS RICARDO DE CARVALHO REIMER</strong>");
        assertThat(out).contains("<strong>GLOBO COMERCIO, CONSTRUÇÕES E SERVIÇOS EIRELI</strong>");
    }

    @Test
    void aplicarNegritoNomesCompletos_colapsaVirgulaAoNomeSemEspaco() {
        String html = ContratoLocacaoDocumentoService.textoProcessadoParaHtml(
                "como LOCATÁRIO, Marcus Antonio Cardoso Anacleto , brasileiro");

        String out = ContratoLocacaoNegritoUtil.aplicarNegritoNomesCompletos(
                html, "Marcus Antonio Cardoso Anacleto");

        assertThat(out).contains("<strong>MARCUS ANTONIO CARDOSO ANACLETO</strong>, brasileiro");
        assertThat(out).doesNotContain("ANACLETO</strong> ,");
        assertThat(out).doesNotContain("ANACLETO ,");
    }
}
