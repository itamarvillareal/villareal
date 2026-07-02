package br.com.vilareal.condominio.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CobrancaProprietarioEfetivoUtilTest {

    @Test
    void resolver_priorizaPlanilhaSobreLegado() {
        var efetivo = CobrancaProprietarioEfetivoUtil.resolver(
                "Planilha Nome", "12345678901", "Legado Nome", "98765432100");
        assertThat(efetivo.nome()).isEqualTo("Planilha Nome");
        assertThat(efetivo.docDigitos()).isEqualTo("12345678901");
        assertThat(efetivo.fonte()).isEqualTo(CobrancaProprietarioEfetivoUtil.FonteProprietario.PLANILHA);
    }

    @Test
    void cpfEquivalente_ignoraZerosEsquerda() {
        assertThat(CobrancaProprietarioEfetivoUtil.cpfEquivalente("3772491146", "03772491146")).isTrue();
    }
}
