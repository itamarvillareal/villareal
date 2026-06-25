package br.com.vilareal.financeiro.application;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InvestimentoImpostosAlocacaoTest {

    @Test
    void parcelaProporcional_rateiaPeloValorDeVenda() {
        BigDecimal total = new BigDecimal("508.63");
        BigDecimal base = new BigDecimal("178323.49");
        assertEquals(
                new BigDecimal("69.75"),
                InvestimentoMovimentacaoApplicationService.parcelaProporcional(
                        total, new BigDecimal("24455.27"), base));
        assertEquals(
                new BigDecimal("173.05"),
                InvestimentoMovimentacaoApplicationService.parcelaProporcional(
                        total, new BigDecimal("60669.96"), base));
    }
}
