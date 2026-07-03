package br.com.vilareal.financeiro.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FinanceiroApplicationServiceNumeroImovelFiltroTest {

    @Test
    void normalizarNumeroImovelFiltro_aceita1a999() {
        assertThat(FinanceiroApplicationService.normalizarNumeroImovelFiltro("57")).isEqualTo("57");
        assertThat(FinanceiroApplicationService.normalizarNumeroImovelFiltro(" 057 ")).isEqualTo("57");
        assertThat(FinanceiroApplicationService.normalizarNumeroImovelFiltro("999")).isEqualTo("999");
    }

    @Test
    void normalizarNumeroImovelFiltro_rejeitaForaDoIntervalo() {
        assertThat(FinanceiroApplicationService.normalizarNumeroImovelFiltro("0")).isEmpty();
        assertThat(FinanceiroApplicationService.normalizarNumeroImovelFiltro("1000")).isEmpty();
        assertThat(FinanceiroApplicationService.normalizarNumeroImovelFiltro("abc")).isEmpty();
    }

    @Test
    void normalizarNumeroImovelFiltro_vazioRetornaNull() {
        assertThat(FinanceiroApplicationService.normalizarNumeroImovelFiltro(null)).isNull();
        assertThat(FinanceiroApplicationService.normalizarNumeroImovelFiltro("  ")).isNull();
    }
}
