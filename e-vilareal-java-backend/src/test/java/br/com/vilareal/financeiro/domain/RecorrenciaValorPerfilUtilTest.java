package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class RecorrenciaValorPerfilUtilTest {

    @Test
    void calcularPerfil_valorFixoComParticipacaoAlta() {
        List<BigDecimal> valores = IntStream.range(0, 10)
                .mapToObj(i -> new BigDecimal("100.00"))
                .toList();
        valores = new java.util.ArrayList<>(valores);
        valores.add(new BigDecimal("100.00"));
        valores.add(new BigDecimal("100.00"));
        valores.add(new BigDecimal("105.00"));

        RecorrenciaValorPerfilUtil.PerfilValor perfil = RecorrenciaValorPerfilUtil.calcularPerfil(valores);

        assertThat(perfil.valorModal()).isEqualByComparingTo("100.00");
        assertThat(perfil.participacaoModal()).isGreaterThanOrEqualTo(0.80);
        assertThat(perfil.valorFixo()).isTrue();
    }

    @Test
    void classificar_exatoAproximadoEDivergente() {
        BigDecimal modal = new BigDecimal("100.00");

        assertThat(RecorrenciaValorPerfilUtil.classificar(new BigDecimal("100.00"), modal))
                .isEqualTo(RecorrenciaValorPerfilUtil.ClassePrecisao.EXATO);
        assertThat(RecorrenciaValorPerfilUtil.classificar(new BigDecimal("103.00"), modal))
                .isEqualTo(RecorrenciaValorPerfilUtil.ClassePrecisao.APROXIMADO);
        assertThat(RecorrenciaValorPerfilUtil.classificar(new BigDecimal("60.00"), modal))
                .isEqualTo(RecorrenciaValorPerfilUtil.ClassePrecisao.DIVERGENTE);
    }

    @Test
    void aceita_respeitaFiltroPrecisao() {
        assertThat(RecorrenciaValorPerfilUtil.aceita(
                        RecorrenciaValorPerfilUtil.ClassePrecisao.EXATO, PrecisaoValorRecorrencia.EXATO))
                .isTrue();
        assertThat(RecorrenciaValorPerfilUtil.aceita(
                        RecorrenciaValorPerfilUtil.ClassePrecisao.APROXIMADO, PrecisaoValorRecorrencia.EXATO))
                .isFalse();
        assertThat(RecorrenciaValorPerfilUtil.aceita(
                        RecorrenciaValorPerfilUtil.ClassePrecisao.APROXIMADO, PrecisaoValorRecorrencia.TODOS))
                .isTrue();
        assertThat(RecorrenciaValorPerfilUtil.aceita(
                        RecorrenciaValorPerfilUtil.ClassePrecisao.DIVERGENTE, PrecisaoValorRecorrencia.TODOS))
                .isFalse();
        assertThat(RecorrenciaValorPerfilUtil.aceita(
                        RecorrenciaValorPerfilUtil.ClassePrecisao.DIVERGENTE, PrecisaoValorRecorrencia.IGNORAR_VALOR))
                .isTrue();
    }
}
