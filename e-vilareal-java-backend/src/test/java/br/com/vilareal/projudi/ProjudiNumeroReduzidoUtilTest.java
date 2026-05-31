package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProjudiNumeroReduzidoUtilTest {

    @Test
    void converteCnjComMascara() {
        assertEquals("5717034.38",
                ProjudiNumeroReduzidoUtil.cnjParaNumeroReduzido("5717034-38.2026.8.09.0051"));
    }

    @Test
    void removeZeroAEsquerdaDoSequencial() {
        assertEquals("148032.91",
                ProjudiNumeroReduzidoUtil.cnjParaNumeroReduzido("0148032-91.2009.8.09.0002"));
    }

    @Test
    void converteCnjSemMascara() {
        assertEquals("5717034.38",
                ProjudiNumeroReduzidoUtil.cnjParaNumeroReduzido("57170343820268090051"));
    }

    @Test
    void idempotenteParaNumeroJaReduzido() {
        assertEquals("5717034.38",
                ProjudiNumeroReduzidoUtil.cnjParaNumeroReduzido("5717034.38"));
    }
}
