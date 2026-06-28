package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiSessionServiceAjaxTest {

    @Test
    void ajaxDeveRetentar_quandoStatus555() {
        assertTrue(ProjudiSessionService.ajaxDeveRetentar(new ProjudiSessionService.RespostaProjudi(555, "")));
    }

    @Test
    void ajaxDeveRetentar_quandoStatus200() {
        assertFalse(ProjudiSessionService.ajaxDeveRetentar(new ProjudiSessionService.RespostaProjudi(200, "[]")));
    }

    @Test
    void mensagemFalhaHttpAjax_destaca555() {
        String msg = ProjudiSessionService.mensagemFalhaHttpAjax(555);
        assertTrue(msg.contains("555"));
        assertTrue(msg.contains("sessão"));
    }
}
