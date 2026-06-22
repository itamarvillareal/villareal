package br.com.vilareal.imovel.application;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class DespesaCondominioAutoConciliacaoServiceTest {

    @Test
    void toleranciaQuinzePorcento() {
        assertThat(DespesaCondominioAutoConciliacaoService.valorDentroTolerancia(
                        new BigDecimal("862.20"), new BigDecimal("780.00")))
                .isTrue();
        assertThat(DespesaCondominioAutoConciliacaoService.valorDentroTolerancia(
                        new BigDecimal("862.20"), new BigDecimal("700.00")))
                .isFalse();
    }

    @Test
    void grafiaCasaDescricaoNorm() {
        var l = new br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity();
        l.setDescricao("Boleto pago - Condominio Do Edif Residencial Executive Prive");
        l.setDescricaoNorm("BOLETO PAGO CONDOMINIO DO EDIF RESIDENCIAL EXECUTIVE PRIVE");

        assertThat(DespesaCondominioGrafiasUtil.debitoCasaGrafia(
                        l, "CONDOMINIO DO EDIF RESIDENCIAL EXECUTIVE PRIVE"))
                .isTrue();
    }
}
