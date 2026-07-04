package br.com.vilareal.common.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TelefoneBrasilUtilCanonicalizarTest {

    @Test
    void canonicalizar_celularGoSemNonoDigito_insere9() {
        assertThat(TelefoneBrasilUtil.canonicalizar("556292975894")).isEqualTo("5562992975894");
    }

    @Test
    void canonicalizar_celularGoComNonoDigito_inalterado() {
        assertThat(TelefoneBrasilUtil.canonicalizar("5562992975894")).isEqualTo("5562992975894");
    }

    @Test
    void canonicalizar_fixoGo_inalterado() {
        assertThat(TelefoneBrasilUtil.canonicalizar("556232179999")).isEqualTo("556232179999");
    }

    @Test
    void canonicalizar_comMascara_celular() {
        assertThat(TelefoneBrasilUtil.canonicalizar("5562 9 8234-5000")).isEqualTo("5562982345000");
    }

    @Test
    void canonicalizar_semDdi_celularSem9() {
        assertThat(TelefoneBrasilUtil.canonicalizar("6292975894")).isEqualTo("5562992975894");
    }

    @Test
    void canonicalizar_semDdi_celularCom9() {
        assertThat(TelefoneBrasilUtil.canonicalizar("62992975894")).isEqualTo("5562992975894");
    }

    @Test
    void canonicalizar_semDdi_fixo() {
        assertThat(TelefoneBrasilUtil.canonicalizar("6232179999")).isEqualTo("556232179999");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "123", "556299", "556299999999999"})
    void canonicalizar_invalido_lancaExcecao(String input) {
        assertThatThrownBy(() -> TelefoneBrasilUtil.canonicalizar(input))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void canonicalizar_nulo_lancaExcecao() {
        assertThatThrownBy(() -> TelefoneBrasilUtil.canonicalizar(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void normalizarParaArmazenamento_paridadeComCanonicalizar() {
        assertThat(TelefoneBrasilUtil.normalizarParaArmazenamento("556292975894"))
                .contains("5562992975894");
        assertThat(TelefoneBrasilUtil.normalizarParaArmazenamento("556232179999"))
                .contains("556232179999");
        assertThat(TelefoneBrasilUtil.normalizarParaArmazenamento("invalido")).isEmpty();
    }

    @Test
    void aplicarNonoDigitoCelular_extraiDddELocalCorretamente() {
        assertThat(TelefoneBrasilUtil.aplicarNonoDigitoCelular("556292975894", "556292975894"))
                .isEqualTo("5562992975894");
    }
}
