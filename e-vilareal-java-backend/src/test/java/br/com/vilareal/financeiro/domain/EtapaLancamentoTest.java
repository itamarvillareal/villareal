package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EtapaLancamentoTest {

    @Test
    void calcular_contaEComGrupo_semContagem_retornaPendente() {
        assertThat(EtapaLancamento.calcular("E", "11336", null)).isEqualTo(EtapaLancamento.IMPORTADO);
    }

    @Test
    void calcularContaE_comParCompleto_retornaCompensado() {
        assertThat(EtapaLancamento.calcularContaE("11336", 2)).isEqualTo(EtapaLancamento.COMPENSADO);
        assertThat(EtapaLancamento.calcularContaE("11336", 3)).isEqualTo(EtapaLancamento.COMPENSADO);
    }

    @Test
    void calcularContaE_semPar_retornaPendente() {
        assertThat(EtapaLancamento.calcularContaE("11336", 1)).isEqualTo(EtapaLancamento.IMPORTADO);
        assertThat(EtapaLancamento.calcularContaE("11336", 0)).isEqualTo(EtapaLancamento.IMPORTADO);
    }

    @Test
    void calcularContaE_semGrupo_retornaClassificado() {
        assertThat(EtapaLancamento.calcularContaE(null, 0)).isEqualTo(EtapaLancamento.CLASSIFICADO);
        assertThat(EtapaLancamento.calcularContaE("  ", 1)).isEqualTo(EtapaLancamento.CLASSIFICADO);
    }
}
