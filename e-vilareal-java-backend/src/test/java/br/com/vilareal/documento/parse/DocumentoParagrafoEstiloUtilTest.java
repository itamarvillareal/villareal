package br.com.vilareal.documento.parse;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoParagrafoEstiloUtilTest {

    @Test
    void twipsToCm_converte1418Twips() {
        assertThat(DocumentoParagrafoEstiloUtil.twipsToCm(1418)).isEqualTo("2.50cm");
    }

    @Test
    void twipsToCm_converte851Twips() {
        assertThat(DocumentoParagrafoEstiloUtil.twipsToCm(851)).isEqualTo("1.50cm");
    }
}
