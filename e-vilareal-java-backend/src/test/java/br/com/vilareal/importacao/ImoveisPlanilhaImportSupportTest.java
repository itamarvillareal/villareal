package br.com.vilareal.importacao;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class ImoveisPlanilhaImportSupportTest {

    @Test
    void parseValorRealBr_virgulaDecimal() {
        assertThat(ImoveisPlanilhaImportSupport.parseValorRealBr("1.234,56"))
                .isEqualByComparingTo(new BigDecimal("1234.56"));
        assertThat(ImoveisPlanilhaImportSupport.parseValorRealBr("R$ 99,00"))
                .isEqualByComparingTo(new BigDecimal("99.00"));
    }

    @Test
    void normalizarSimNao() {
        assertThat(ImoveisPlanilhaImportSupport.normalizarSimNao("Sim")).isEqualTo("sim");
        assertThat(ImoveisPlanilhaImportSupport.normalizarSimNao("NÃO")).isEqualTo("nao");
        assertThat(ImoveisPlanilhaImportSupport.normalizarSimNao("")).isEmpty();
    }

    @Test
    void parseDataFlex_br() {
        assertThat(ImoveisPlanilhaImportSupport.parseDataFlex("08/04/2026")).isEqualTo(LocalDate.of(2026, 4, 8));
    }
}
