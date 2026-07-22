package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProjudiPrioridadeProcessoInicialTest {

    @Test
    void deAutorMaiorDe60Anos_falseRetornaNormal() {
        assertEquals(1, ProjudiPrioridadeProcessoInicial.deAutorMaiorDe60Anos(false).idProcessoPrioridade());
    }

    @Test
    void deAutorMaiorDe60Anos_semHtmlCaiNoFallbackLegado() {
        assertEquals(6, ProjudiPrioridadeProcessoInicial.deAutorMaiorDe60Anos(true).idProcessoPrioridade());
    }
}
