package br.com.vilareal.pje.application;

import br.com.vilareal.pje.domain.PjeTribunal;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PjeTribunalCnjResolverTest {

    @Test
    void resolverPorCnj_trt18() {
        assertThat(PjeTribunalCnjResolver.resolverPorCnj("0000105-21.2025.5.18.0051"))
                .contains(PjeTribunal.PJE_TRT18);
        assertThat(PjeTribunalCnjResolver.cnjEhTrt18("0000105-21.2025.5.18.0051")).isTrue();
    }

    @Test
    void resolverPorCnj_trf1() {
        assertThat(PjeTribunalCnjResolver.resolverPorCnj("0001234-56.2024.4.01.0001"))
                .contains(PjeTribunal.PJE_TRF1);
    }

    @Test
    void resolverPorCnj_tjgo() {
        assertThat(PjeTribunalCnjResolver.resolverPorCnj("5402633-78.2017.8.09.0006"))
                .contains(PjeTribunal.PJE_TJGO);
    }

    @Test
    void resolverPorCnj_naoMapeado() {
        assertThat(PjeTribunalCnjResolver.resolverPorCnj("0000000-00.2000.8.99.0000")).isEmpty();
    }
}
