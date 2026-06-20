package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContratoPartesProcessoResolverTest {

    @Test
    void poloEhAutor_reconheceAutorERequerente() {
        assertThat(ContratoPartesProcessoResolver.poloEhAutor("AUTOR")).isTrue();
        assertThat(ContratoPartesProcessoResolver.poloEhAutor("Requerente")).isTrue();
        assertThat(ContratoPartesProcessoResolver.poloEhAutor("REU")).isFalse();
    }

    @Test
    void poloEhReu_reconheceReuERequerido() {
        assertThat(ContratoPartesProcessoResolver.poloEhReu("RÉU")).isTrue();
        assertThat(ContratoPartesProcessoResolver.poloEhReu("Requerido")).isTrue();
        assertThat(ContratoPartesProcessoResolver.poloEhReu("AUTOR")).isFalse();
    }

    @Test
    void montarPreambuloContratoAluguel_usaLocadorELocatario() {
        String html = QualificacaoPessoaUtil.montarPreambuloContratoAluguel("LOCADOR X", "LOCATÁRIO Y");
        assertThat(html).contains("LOCADOR").contains("LOCADOR X").contains("LOCATÁRIO Y");
    }
}
