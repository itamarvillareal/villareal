package br.com.vilareal.pessoa.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PessoaTelefoneBuscaTest {

    @Test
    void normalizarTelefoneBusca_extraiDigitos() {
        assertThat(PessoaApplicationService.normalizarTelefoneBusca("(62) 99325-4445")).isEqualTo("62993254445");
    }

    @Test
    void normalizarTelefoneBusca_rejeitaCurto() {
        assertThat(PessoaApplicationService.normalizarTelefoneBusca("629")).isNull();
        assertThat(PessoaApplicationService.normalizarTelefoneBusca("")).isNull();
        assertThat(PessoaApplicationService.normalizarTelefoneBusca(null)).isNull();
    }

    @Test
    void normalizarTelefoneBusca_aceitaParcial() {
        assertThat(PessoaApplicationService.normalizarTelefoneBusca("93254445")).isEqualTo("93254445");
    }
}
