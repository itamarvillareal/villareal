package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class CompensacaoDateUtilsTest {

    private static final LocalDate SEXTA = LocalDate.of(2025, 3, 14);
    private static final LocalDate SABADO = LocalDate.of(2025, 3, 15);
    private static final LocalDate DOMINGO = LocalDate.of(2025, 3, 16);
    private static final LocalDate SEGUNDA = LocalDate.of(2025, 3, 17);
    private static final LocalDate QUINTA = LocalDate.of(2025, 3, 13);

    @Test
    void normalizar_sexta_retornaSegundaSeguinte() {
        assertThat(CompensacaoDateUtils.normalizarParaDiaUtil(SEXTA)).isEqualTo(SEGUNDA);
    }

    @Test
    void normalizar_sabado_retornaSegundaSeguinte() {
        assertThat(CompensacaoDateUtils.normalizarParaDiaUtil(SABADO)).isEqualTo(SEGUNDA);
    }

    @Test
    void normalizar_domingo_retornaSegundaSeguinte() {
        assertThat(CompensacaoDateUtils.normalizarParaDiaUtil(DOMINGO)).isEqualTo(SEGUNDA);
    }

    @Test
    void normalizar_segunda_retornaElaMesma() {
        assertThat(CompensacaoDateUtils.normalizarParaDiaUtil(SEGUNDA)).isEqualTo(SEGUNDA);
    }

    @Test
    void normalizar_quinta_retornaElaMesma() {
        assertThat(CompensacaoDateUtils.normalizarParaDiaUtil(QUINTA)).isEqualTo(QUINTA);
    }

    @Test
    void mesmoDiaUtil_sextaESegunda_true() {
        assertThat(CompensacaoDateUtils.mesmoDiaUtilBancario(SEXTA, SEGUNDA)).isTrue();
    }

    @Test
    void mesmoDiaUtil_sabadoESegunda_true() {
        assertThat(CompensacaoDateUtils.mesmoDiaUtilBancario(SABADO, SEGUNDA)).isTrue();
    }

    @Test
    void mesmoDiaUtil_domingoESegunda_true() {
        assertThat(CompensacaoDateUtils.mesmoDiaUtilBancario(DOMINGO, SEGUNDA)).isTrue();
    }

    @Test
    void mesmoDiaUtil_segundaESegunda_true() {
        assertThat(CompensacaoDateUtils.mesmoDiaUtilBancario(SEGUNDA, SEGUNDA)).isTrue();
    }

    @Test
    void mesmoDiaUtil_sextaESexta_true() {
        assertThat(CompensacaoDateUtils.mesmoDiaUtilBancario(SEXTA, SEXTA)).isTrue();
    }

    @Test
    void mesmoDiaUtil_quintaESegunda_false() {
        assertThat(CompensacaoDateUtils.mesmoDiaUtilBancario(QUINTA, SEGUNDA)).isFalse();
    }

    @Test
    void mesmoDiaUtil_quintaESexta_false() {
        assertThat(CompensacaoDateUtils.mesmoDiaUtilBancario(QUINTA, SEXTA)).isFalse();
    }
}
