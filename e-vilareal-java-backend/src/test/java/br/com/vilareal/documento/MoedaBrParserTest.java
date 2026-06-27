package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class MoedaBrParserTest {

    @Test
    void parse_isoDecimalNaoViraCentavosMultiplicados() {
        assertThat(MoedaBrParser.parseValorMonetario("1650.00"))
                .isEqualByComparingTo(new BigDecimal("1650.00"));
    }

    @Test
    void parse_formatoBr() {
        assertThat(MoedaBrParser.parseValorMonetario("1.650,00"))
                .isEqualByComparingTo(new BigDecimal("1650.00"));
        assertThat(MoedaBrParser.parseValorMonetario("1650,00"))
                .isEqualByComparingTo(new BigDecimal("1650.00"));
    }

    @Test
    void parse_inteiroSimples() {
        assertThat(MoedaBrParser.parseValorMonetario("1700"))
                .isEqualByComparingTo(new BigDecimal("1700"));
    }

    @Test
    void formatDecimalBr() {
        assertThat(MoedaBrParser.formatDecimalBr(new BigDecimal("1650")))
                .isEqualTo("1650,00");
    }
}
