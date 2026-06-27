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
        assertThat(html).contains("têm por justo e contratado o seguinte:");
    }

    @Test
    void montarPreambuloContratoAluguel_pluralComQualificacoesCompletasEncadeadas() {
        String loc1 = "Carlos Silva, brasileiro, solteiro, portador do CPF nº 111";
        String loc2 = "Globo Comercio Ltda, pessoa jurídica de direito privado, inscrita no CNPJ nº 222";
        String loc3 = "Amilson Oliveira, brasileiro, casado, portador do CPF nº 333";
        String preambulo = QualificacaoPessoaUtil.montarPreambuloContratoAluguel(
                "VRV Soluções Ltda, pessoa jurídica", loc1 + ", e " + loc2 + ", e " + loc3, true);

        assertThat(preambulo).contains("como LOCADOR, VRV Soluções Ltda");
        assertThat(preambulo).contains("como LOCATÁRIOS, Carlos Silva");
        assertThat(preambulo).contains(", e Globo Comercio Ltda");
        assertThat(preambulo).contains(", e Amilson Oliveira");
        assertThat(preambulo).doesNotContain(", a,");
        assertThat(preambulo).doesNotContain(", ,");
    }

    @Test
    void montarPreambuloContratoAluguel_removeVirgulaFinalDaQualificacaoDoLocador() {
        String locador = "VRV Soluções Ltda, pessoa jurídica, CEP 75.110-580,";
        String locatario = "Marcus Antonio Cardoso Anacleto, brasileiro, solteiro";

        String preambulo = QualificacaoPessoaUtil.montarPreambuloContratoAluguel(locador, locatario, true);

        assertThat(preambulo).contains("CEP 75.110-580, e, como LOCATÁRIOS");
        assertThat(preambulo).doesNotContain("CEP 75.110-580, , e");
        assertThat(preambulo).doesNotContain(", ,");
    }
}
