package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FinanceiroDescricaoIndicaContaFTest {

    @Test
    void indica_corJursCri() {
        assertThat(FinanceiroDescricaoIndicaContaF.indica("COR JURS CRI Brookfield", null))
                .isTrue();
        assertThat(FinanceiroDescricaoIndicaContaF.indica("COR JURS CRI ALIANSCE", ""))
                .isTrue();
    }

    @Test
    void indica_jurosLcaCdb() {
        assertThat(FinanceiroDescricaoIndicaContaF.indica("JUROS POUPANCA", null)).isTrue();
        assertThat(FinanceiroDescricaoIndicaContaF.indica("RESGATE LCA BANCO", null)).isTrue();
        assertThat(FinanceiroDescricaoIndicaContaF.indica("COMPRA CDB BMG", null)).isTrue();
    }

    @Test
    void naoIndica_pixComum() {
        assertThat(FinanceiroDescricaoIndicaContaF.indica("PIX TRANSF Itamar", null)).isFalse();
    }
}
