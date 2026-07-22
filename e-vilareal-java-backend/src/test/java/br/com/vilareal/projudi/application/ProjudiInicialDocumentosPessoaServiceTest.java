package br.com.vilareal.projudi.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiInicialDocumentosPessoaServiceTest {

    @Test
    void ehPessoaJuridica_reconheceCnpj14Digitos() {
        assertThat(ProjudiInicialDocumentosPessoaService.ehPessoaJuridica("09.319.421/0001-54")).isTrue();
        assertThat(ProjudiInicialDocumentosPessoaService.ehPessoaJuridica("123.456.789-09")).isFalse();
        assertThat(ProjudiInicialDocumentosPessoaService.ehPessoaJuridica(null)).isFalse();
    }
}
