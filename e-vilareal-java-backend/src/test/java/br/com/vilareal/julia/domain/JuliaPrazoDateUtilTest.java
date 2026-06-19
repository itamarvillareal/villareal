package br.com.vilareal.julia.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class JuliaPrazoDateUtilTest {

    @Test
    void subtrair_tresDiasUteis_deSegunda_retornaQuartaAnterior() {
        LocalDate segunda = LocalDate.of(2026, 6, 1);
        assertThat(JuliaPrazoDateUtil.subtrairDiasUteis(segunda, 3)).isEqualTo(LocalDate.of(2026, 5, 27));
    }

    @Test
    void subtrair_tresDiasUteis_travessiaFimDeSemana_pulaSabadoDomingo() {
        // Seg 2026-06-08 − 3 úteis = Qua 2026-06-03 (não conta sáb 6 e dom 7)
        LocalDate segunda = LocalDate.of(2026, 6, 8);
        assertThat(JuliaPrazoDateUtil.subtrairDiasUteis(segunda, 3)).isEqualTo(LocalDate.of(2026, 6, 3));
    }

    @Test
    void subtrair_tresDiasUteis_dataRealSabado_contaSoDiasUteis() {
        LocalDate sabado = LocalDate.of(2026, 6, 6);
        assertThat(JuliaPrazoDateUtil.subtrairDiasUteis(sabado, 3)).isEqualTo(LocalDate.of(2026, 6, 3));
    }

    @Test
    void avancarParaProximoDiaUtil_sabado_vaiParaSegunda() {
        assertThat(JuliaPrazoDateUtil.avancarParaProximoDiaUtil(LocalDate.of(2026, 6, 20)))
                .isEqualTo(LocalDate.of(2026, 6, 22));
    }

    @Test
    void avancarParaProximoDiaUtil_diaUtil_mantem() {
        LocalDate segunda = LocalDate.of(2026, 6, 22);
        assertThat(JuliaPrazoDateUtil.avancarParaProximoDiaUtil(segunda)).isEqualTo(segunda);
    }

    @Test
    void subtrair_zeroDias_retornaMesmaData() {
        LocalDate data = LocalDate.of(2026, 6, 10);
        assertThat(JuliaPrazoDateUtil.subtrairDiasUteis(data, 0)).isEqualTo(data);
    }

    @Test
    void subtrair_null_retornaNull() {
        assertThat(JuliaPrazoDateUtil.subtrairDiasUteis(null, 3)).isNull();
    }

    @Test
    void somar_quinzeDiasUteis_deQuarta_retornaPrimeiroJulho() {
        LocalDate quarta = LocalDate.of(2026, 6, 10);
        assertThat(JuliaPrazoDateUtil.somarDiasUteis(quarta, 15)).isEqualTo(LocalDate.of(2026, 7, 1));
    }

    @Test
    void somar_doisDiasUteis_deQuarta_retornaSexta() {
        LocalDate quarta = LocalDate.of(2026, 6, 10);
        assertThat(JuliaPrazoDateUtil.somarDiasUteis(quarta, 2)).isEqualTo(LocalDate.of(2026, 6, 12));
    }

    @Test
    void somar_zeroDias_retornaMesmaDataAjustada() {
        LocalDate sabado = LocalDate.of(2026, 6, 20);
        assertThat(JuliaPrazoDateUtil.somarDiasUteis(sabado, 0)).isEqualTo(LocalDate.of(2026, 6, 22));
    }
}
