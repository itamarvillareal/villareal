package br.com.vilareal.calculo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RegraInicioCobrancaDiasValidatorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void parse_valoresPermitidos() {
        assertThat(RegraInicioCobrancaDiasValidator.parse(objectMapper.valueToTree(1))).isEqualTo(1);
        assertThat(RegraInicioCobrancaDiasValidator.parse(objectMapper.valueToTree(61)))
                .isEqualTo(RegraInicioCobrancaDiasValidator.REGRA_CONDICIONAL_60_MAIS_1);
    }

    @Test
    void parse_migraLegado30e60ParaRegraCondicional61() {
        assertThat(RegraInicioCobrancaDiasValidator.parse(objectMapper.valueToTree(30)))
                .isEqualTo(RegraInicioCobrancaDiasValidator.REGRA_CONDICIONAL_60_MAIS_1);
        assertThat(RegraInicioCobrancaDiasValidator.parse(objectMapper.valueToTree(60)))
                .isEqualTo(RegraInicioCobrancaDiasValidator.REGRA_CONDICIONAL_60_MAIS_1);
    }

    @Test
    void parse_ausenciaRetornaDefault() {
        assertThat(RegraInicioCobrancaDiasValidator.parse(null)).isEqualTo(1);
    }

    @Test
    void parse_rejeitaValorInvalido() {
        assertThatThrownBy(() -> RegraInicioCobrancaDiasValidator.parse(objectMapper.valueToTree(15)))
                .isInstanceOf(BusinessRuleException.class);
    }
}
