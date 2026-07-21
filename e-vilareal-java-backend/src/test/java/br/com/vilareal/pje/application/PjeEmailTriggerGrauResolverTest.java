package br.com.vilareal.pje.application;

import br.com.vilareal.pje.domain.PjeGrau;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PjeEmailTriggerGrauResolverTest {

    @Test
    void inferirSegundoGrauPorTurma() {
        String json = "{\"trt\":{\"orgaoJulgador\":\"1ª Turma do TRT18\"}}";
        assertThat(PjeEmailTriggerGrauResolver.resolver(json, PjeGrau.PRIMEIRO_GRAU))
                .isEqualTo(PjeGrau.SEGUNDO_GRAU);
    }

    @Test
    void inferirPrimeiroGrauPorVara() {
        String json = "{\"trt\":{\"orgaoJulgador\":\"2ª VARA DO TRABALHO DE ANÁPOLIS\"}}";
        assertThat(PjeEmailTriggerGrauResolver.resolver(json, PjeGrau.PRIMEIRO_GRAU))
                .isEqualTo(PjeGrau.PRIMEIRO_GRAU);
    }
}
