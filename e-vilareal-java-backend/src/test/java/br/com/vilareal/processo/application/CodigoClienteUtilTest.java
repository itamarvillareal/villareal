package br.com.vilareal.processo.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CodigoClienteUtilTest {

    @Test
    void normalizarCodigoClienteOitoDigitos_variacoesNumericas() {
        assertThat(CodigoClienteUtil.normalizarCodigoClienteOitoDigitos("1")).isEqualTo("00000001");
        assertThat(CodigoClienteUtil.normalizarCodigoClienteOitoDigitos("0001")).isEqualTo("00000001");
        assertThat(CodigoClienteUtil.normalizarCodigoClienteOitoDigitos("00000001")).isEqualTo("00000001");
        assertThat(CodigoClienteUtil.normalizarCodigoClienteOitoDigitos("  42  ")).isEqualTo("00000042");
    }

    @Test
    void normalizarCodigoClienteOitoDigitos_naoNumerico_inalterado() {
        assertThat(CodigoClienteUtil.normalizarCodigoClienteOitoDigitos("ABC")).isEqualTo("ABC");
    }
}
