package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiInicialOpcoesPasso3Test {

    @Test
    void of_converteBooleanNuloComoFalse() {
        var opcoes = ProjudiInicialOpcoesPasso3.of(null, null, null);
        assertFalse(opcoes.segredoJustica());
        assertFalse(opcoes.naoMarcarAudiencia());
        assertFalse(opcoes.juizo100Digital());
    }

    @Test
    void aplicarEmCampos_respeitaValoresProjudi() {
        Map<String, String> campos = new LinkedHashMap<>();
        campos.put("SegredoJustica", "true");
        campos.put("digital100", "true");

        new ProjudiInicialOpcoesPasso3(true, true, false).aplicarEmCampos(campos);

        assertEquals("true", campos.get("SegredoJustica"));
        assertEquals("false", campos.get("NaoMarcarAudiencia"));
        assertFalse(campos.containsKey("digital100"));
    }
}
