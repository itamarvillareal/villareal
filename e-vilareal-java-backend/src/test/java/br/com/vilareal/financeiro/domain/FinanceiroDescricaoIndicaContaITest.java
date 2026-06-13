package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FinanceiroDescricaoIndicaContaITest {

    @Test
    void indica_financImobiliarioAbreviado() {
        assertThat(FinanceiroDescricaoIndicaContaI.indica("FINANC IMOBILIARIO 022 420", null))
                .isTrue();
    }

    @Test
    void indica_financiamentoImobiliarioPorExtenso() {
        assertThat(FinanceiroDescricaoIndicaContaI.indica("FINANCIAMENTO IMOBILIARIO PARCELA 12", null))
                .isTrue();
    }

    @Test
    void naoIndica_pixComum() {
        assertThat(FinanceiroDescricaoIndicaContaI.indica("PIX TRANSF ITAMAR", null)).isFalse();
    }
}
