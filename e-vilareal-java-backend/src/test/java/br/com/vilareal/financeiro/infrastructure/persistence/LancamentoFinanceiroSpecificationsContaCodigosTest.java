package br.com.vilareal.financeiro.infrastructure.persistence;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LancamentoFinanceiroSpecificationsContaCodigosTest {

    @Test
    void parseContaCodigosParam_normalizaLista() {
        assertEquals(LancamentoFinanceiroSpecifications.parseContaCodigosParam("A,e, F"), java.util.List.of("A", "E", "F"));
        assertTrue(LancamentoFinanceiroSpecifications.parseContaCodigosParam("").isEmpty());
        assertTrue(LancamentoFinanceiroSpecifications.parseContaCodigosParam(null).isEmpty());
    }
}
