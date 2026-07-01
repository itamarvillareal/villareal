package br.com.vilareal.common.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TelefoneBrasilUtilTest {

    @Test
    void normalizarParaArmazenamento_adicionaDdi55() {
        assertThat(TelefoneBrasilUtil.normalizarParaArmazenamento("(62) 99999-1234"))
                .contains("5562999991234");
    }

    @Test
    void extrairPrimeiroValido_textoComDoisNumeros() {
        assertThat(TelefoneBrasilUtil.extrairPrimeiroValido("61 98312-3456 / 61 98234-5678"))
                .contains("5561983123456");
    }

    @Test
    void extrairPrimeiroValido_textoComObservacao() {
        assertThat(TelefoneBrasilUtil.extrairPrimeiroValido("61 98312-3456 (João)"))
                .contains("5561983123456");
    }

    @Test
    void extrairPrimeiroValido_invalido() {
        assertThat(TelefoneBrasilUtil.extrairPrimeiroValido("sem telefone")).isEmpty();
    }

    @Test
    void numerosEquivalentes_comparacaoPorSufixo() {
        assertThat(TelefoneBrasilUtil.numerosEquivalentes("5562999991234", "62999991234"))
                .isTrue();
    }
}
