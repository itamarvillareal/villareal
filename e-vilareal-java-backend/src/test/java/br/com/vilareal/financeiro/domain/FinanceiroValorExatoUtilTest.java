package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FinanceiroValorExatoUtilTest {

    @Test
    void parseValorAbsolutoExato_ignoraSinal() {
        assertThat(FinanceiroValorExatoUtil.parseValorAbsolutoExato("-1500,00"))
                .isEqualByComparingTo(new BigDecimal("1500.00"));
        assertThat(FinanceiroValorExatoUtil.parseValorAbsolutoExato("1500.00"))
                .isEqualByComparingTo(new BigDecimal("1500.00"));
    }

    @Test
    void parseValorAbsolutoExato_rejeitaVazio() {
        assertThatThrownBy(() -> FinanceiroValorExatoUtil.parseValorAbsolutoExato("  "))
                .isInstanceOf(br.com.vilareal.common.exception.BusinessRuleException.class);
    }
}
