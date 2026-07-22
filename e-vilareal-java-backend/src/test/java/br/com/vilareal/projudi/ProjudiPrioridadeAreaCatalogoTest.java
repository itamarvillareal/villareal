package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiPrioridadeAreaCatalogoTest {

    @Test
    void idMaiorDe60Anos_anapolisCivel() {
        assertEquals(2, ProjudiPrioridadeAreaCatalogo.idMaiorDe60Anos(735).orElseThrow());
    }

    @Test
    void idMaiorDe60Anos_areaDesconhecidaVazia() {
        assertTrue(ProjudiPrioridadeAreaCatalogo.idMaiorDe60Anos(19).isEmpty());
    }
}
