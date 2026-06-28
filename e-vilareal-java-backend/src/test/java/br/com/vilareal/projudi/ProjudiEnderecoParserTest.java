package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiEnderecoParserTest {

    @Test
    void parseComNumeroEComplemento() {
        var r = ProjudiEnderecoParser.parse("Avenida Pinheiro Chagas, n. 232, Apto 501");
        assertThat(r.partes().logradouro()).isEqualTo("Avenida Pinheiro Chagas");
        assertThat(r.partes().numero()).isEqualTo("232");
        assertThat(r.partes().complemento()).isEqualTo("Apto 501");
        assertThat(r.baixaConfianca()).isFalse();
    }

    @Test
    void parseSomenteNumero() {
        var r = ProjudiEnderecoParser.parse("AV. ANTONIO XAVIER NUNES, Nº 305");
        assertThat(r.partes().logradouro()).isEqualTo("AV. ANTONIO XAVIER NUNES");
        assertThat(r.partes().numero()).isEqualTo("305");
        assertThat(r.partes().complemento()).isEmpty();
    }

    @Test
    void parseSemNumeroExplicitoUsaSn() {
        var r = ProjudiEnderecoParser.parse("Rua Principal, Bloco B");
        assertThat(r.partes().logradouro()).isEqualTo("Rua Principal");
        assertThat(r.partes().numero()).isEqualTo("SN");
        assertThat(r.partes().complemento()).isEqualTo("Bloco B");
    }

    @Test
    void parseSnComoNumero() {
        var r = ProjudiEnderecoParser.parse("Rua das Flores, S/N, Fundos");
        assertThat(r.partes().logradouro()).isEqualTo("Rua das Flores");
        assertThat(r.partes().numero()).isEqualTo("SN");
        assertThat(r.partes().complemento()).isEqualTo("Fundos");
    }

    @Test
    void parseSemVirgula() {
        var r = ProjudiEnderecoParser.parse("Rua Principal");
        assertThat(r.partes().logradouro()).isEqualTo("Rua Principal");
        assertThat(r.partes().numero()).isEqualTo("SN");
        assertThat(r.partes().complemento()).isEmpty();
    }

    @Test
    void parseVazio() {
        var r = ProjudiEnderecoParser.parse("   ");
        assertThat(r.partes().logradouro()).isEmpty();
        assertThat(r.partes().numero()).isEqualTo("SN");
        assertThat(r.baixaConfianca()).isTrue();
    }

    @Test
    void parseNumeroInlineSemVirgulaAntes() {
        var r = ProjudiEnderecoParser.parse("Rua Aparecida nº 10");
        assertThat(r.partes().logradouro()).isEqualTo("Rua Aparecida");
        assertThat(r.partes().numero()).isEqualTo("10");
    }
}
