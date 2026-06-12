package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FinanceiroDescricaoIndicaContaETest {

    @Test
    void indica_vrv() {
        assertThat(FinanceiroDescricaoIndicaContaE.indica("PIX TRANSF VRV SOL11 06", null))
                .isTrue();
        assertThat(FinanceiroDescricaoIndicaContaE.indica("TED CONTA VRV", null)).isTrue();
    }

    @Test
    void indica_itamarTransferencia() {
        assertThat(FinanceiroDescricaoIndicaContaE.indica(
                        "Transf Pix recebida - ITAMAR ALEXANDRE F V R JUNIOR - 007.332.351-90",
                        null))
                .isTrue();
        assertThat(FinanceiroDescricaoIndicaContaE.indica("PIX TRANSF ITAMAR 11 06", null))
                .isTrue();
    }

    @Test
    void naoIndica_pagamentoClienteSemTransferencia() {
        assertThat(FinanceiroDescricaoIndicaContaE.indica(
                        "Pagamento recebido - Luciana Mendonça Gomides De Carvalho - 764.677.911-34",
                        null))
                .isFalse();
    }
}
