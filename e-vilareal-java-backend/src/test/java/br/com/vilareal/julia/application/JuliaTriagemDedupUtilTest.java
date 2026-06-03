package br.com.vilareal.julia.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JuliaTriagemDedupUtilTest {

    @Test
    void classificacaoEhGenerica_detectaRotulosProjudi() {
        assertThat(JuliaTriagemDedupUtil.classificacaoEhGenerica("Informação de intimação/citação"))
                .isTrue();
        assertThat(JuliaTriagemDedupUtil.classificacaoEhGenerica(
                        "Designação de audiência de instrução e julgamento"))
                .isFalse();
    }

    @Test
    void titulosAndamentoEquivalentes_genericosOuIguais() {
        assertThat(JuliaTriagemDedupUtil.titulosAndamentoEquivalentes(
                        "Intimação/citação", "Informação de intimação/citação"))
                .isTrue();
        assertThat(JuliaTriagemDedupUtil.titulosAndamentoEquivalentes(
                        "Designação de audiência", "Homologação de acordo"))
                .isFalse();
    }
}
