package br.com.vilareal.processo.infrastructure.persistence.entity;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ProcessoEntityCnjDigitosTest {

    @Test
    void cnjPadraoComMascaraViraSoDigitos() {
        assertEquals("50593463620268090007",
                ProcessoEntity.extrairCnjDigitos("5059346-36.2026.8.09.0007"));
    }

    @Test
    void cnjJaSemMascaraPermanece() {
        assertEquals("50593463620268090007",
                ProcessoEntity.extrairCnjDigitos("50593463620268090007"));
    }

    @Test
    void numeracaoAntigaForaDoPadraoFicaNull() {
        assertNull(ProcessoEntity.extrairCnjDigitos("039.2006.248.174-5"));
        assertNull(ProcessoEntity.extrairCnjDigitos("248174"));
    }

    @Test
    void nuloEVazioFicamNull() {
        assertNull(ProcessoEntity.extrairCnjDigitos(null));
        assertNull(ProcessoEntity.extrairCnjDigitos(""));
        assertNull(ProcessoEntity.extrairCnjDigitos("sem numero"));
    }
}
