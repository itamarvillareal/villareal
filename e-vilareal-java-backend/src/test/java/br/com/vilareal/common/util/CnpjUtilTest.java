package br.com.vilareal.common.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CnpjUtilTest {

    @Test
    void validarCnpjAceitaValido() {
        assertTrue(CnpjUtil.validarCnpj("04252011000110"));
    }

    @Test
    void validarCnpjRejeitaDigitosErrados() {
        assertFalse(CnpjUtil.validarCnpj("04252011000111"));
    }
}
