package br.com.vilareal.configuracao.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PdpjCodigoServiceTest {

    @Test
    void mascararLogin_ocultaMeio() {
        assertThat(PdpjCodigoService.mascararLogin("00733235190")).isEqualTo("00****90");
        assertThat(PdpjCodigoService.mascararLogin("ab")).isEqualTo("****");
        assertThat(PdpjCodigoService.mascararLogin(null)).isEqualTo("—");
    }
}
