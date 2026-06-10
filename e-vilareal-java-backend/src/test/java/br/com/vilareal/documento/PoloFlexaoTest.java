package br.com.vilareal.documento;

import br.com.vilareal.documento.FlexaoUtil.Genero;
import br.com.vilareal.documento.FlexaoUtil.Numero;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PoloFlexaoTest {

    @Test
    void semPessoasFallbackMasculinoSingular() {
        PoloFlexao p = PoloFlexao.determinar(List.of());
        assertThat(p.genero()).isEqualTo(Genero.MASCULINO);
        assertThat(p.numero()).isEqualTo(Numero.SINGULAR);
    }

    @Test
    void umaPessoaFemininaSingular() {
        PoloFlexao p = PoloFlexao.determinar(List.of(Genero.FEMININO));
        assertThat(p.genero()).isEqualTo(Genero.FEMININO);
        assertThat(p.numero()).isEqualTo(Numero.SINGULAR);
    }

    @Test
    void duasFemininasFemininoPlural() {
        PoloFlexao p = PoloFlexao.determinar(List.of(Genero.FEMININO, Genero.FEMININO));
        assertThat(p.genero()).isEqualTo(Genero.FEMININO);
        assertThat(p.numero()).isEqualTo(Numero.PLURAL);
    }

    @Test
    void doisMasculinosMasculinoPlural() {
        PoloFlexao p = PoloFlexao.determinar(List.of(Genero.MASCULINO, Genero.MASCULINO));
        assertThat(p.genero()).isEqualTo(Genero.MASCULINO);
        assertThat(p.numero()).isEqualTo(Numero.PLURAL);
    }

    @Test
    void mistasMasculinoPlural() {
        PoloFlexao p = PoloFlexao.determinar(List.of(Genero.FEMININO, Genero.MASCULINO));
        assertThat(p.genero()).isEqualTo(Genero.MASCULINO);
        assertThat(p.numero()).isEqualTo(Numero.PLURAL);
    }
}
