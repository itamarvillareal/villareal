package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiProcessoCivelHtmlUtilPrioridadeTest {

    private static final String HTML_SELECT =
            """
            <form>
              <select name="Id_ProcessoPrioridade">
                <option value="1">Normal</option>
                <option value="2">Maior de 60 Anos</option>
                <option value="6">Réu Preso</option>
              </select>
            </form>
            """;

    @Test
    void idProcessoPrioridadePorRotulo_maior60NaoUsaId6() {
        var id = ProjudiProcessoCivelHtmlUtil.idProcessoPrioridadePorRotulo(
                HTML_SELECT, ProjudiPrioridadeProcessoInicial.MAIOR_60_ANOS.rotulo());
        assertTrue(id.isPresent());
        assertEquals(2, id.get());
    }

    @Test
    void deAutorMaiorDe60Anos_usaIdResolvidoDoHtml() {
        var prioridade = ProjudiPrioridadeProcessoInicial.deAutorMaiorDe60Anos(true, 2);
        assertEquals(2, prioridade.idProcessoPrioridade());
        assertEquals("Maior de 60 Anos", prioridade.rotulo());
    }
}
