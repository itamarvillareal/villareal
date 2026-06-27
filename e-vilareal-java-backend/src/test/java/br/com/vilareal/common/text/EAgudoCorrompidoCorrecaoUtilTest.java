package br.com.vilareal.common.text;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EAgudoCorrompidoCorrecaoUtilTest {

    @Test
    void corrigeEAgudoCorrompidoParaSaoNoMeioDaPalavra() {
        assertThat(EAgudoCorrompidoCorrecaoUtil.corrigir("aviso prsãovio de 30 dias")).isEqualTo("aviso prévio de 30 dias");
        assertThat(EAgudoCorrompidoCorrecaoUtil.corrigir("§2º Tambsãom é de responsabilidade"))
                .isEqualTo("§2º Também é de responsabilidade");
        assertThat(EAgudoCorrompidoCorrecaoUtil.corrigir("energia elsãotrica, duchas"))
                .isEqualTo("energia elétrica, duchas");
        assertThat(EAgudoCorrompidoCorrecaoUtil.corrigir("20% do valor do dsãobito atualizado"))
                .isEqualTo("20% do valor do débito atualizado");
        assertThat(EAgudoCorrompidoCorrecaoUtil.corrigir("Dr. Itamar Alexandre Fsãolix Villa Real Junior"))
                .isEqualTo("Dr. Itamar Alexandre Félix Villa Real Junior");
    }

    @Test
    void preservaSaoVerboEGeografico() {
        assertThat(EAgudoCorrompidoCorrecaoUtil.corrigir("Os Locatários são responsáveis"))
                .isEqualTo("Os Locatários são responsáveis");
        assertThat(EAgudoCorrompidoCorrecaoUtil.corrigir("Foro da cidade de Anápolis-GO"))
                .isEqualTo("Foro da cidade de Anápolis-GO");
    }
}
