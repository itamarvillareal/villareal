package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiAssuntoCatalogoServiceTest {

    private final ProjudiAssuntoCatalogoService service = new ProjudiAssuntoCatalogoService();

    @Test
    void listarCatalogo_contemAssuntosConfirmados() {
        var lista = service.listarCatalogo();
        assertTrue(lista.stream().anyMatch(a -> a.idAssunto() == 451));
        assertTrue(lista.stream().anyMatch(a -> a.idAssunto() == 985));
    }

    @Test
    void sugerir_cobrancaRetorna451() {
        assertEquals(451, service.sugerirIdAssunto("Ação de COBRANÇA"));
        assertEquals(451, service.sugerir("COBRANCA DE ALUGUEL").idAssuntoSugerido());
    }

    @Test
    void sugerir_semRegraRetornaNull() {
        assertNull(service.sugerirIdAssunto("EXECUÇÃO DE TÍTULO EXTRAJUDICIAL"));
        assertNull(service.sugerirIdAssunto(""));
        assertNull(service.sugerirIdAssunto(null));
    }

    @Test
    void normalizar_removeAcentos() {
        assertEquals("COBRANCA", ProjudiAssuntoCatalogoService.normalizarNaturezaAcao("Cobrança"));
        assertTrue(ProjudiAssuntoCatalogoService.normalizarNaturezaAcao("  ").isEmpty());
    }
}
