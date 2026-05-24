package br.com.vilareal.common.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CpfUtilTest {

    @Test
    void extraiCpfFormatadoValido() {
        assertEquals("76467791134", CpfUtil.extrairCpfValido("Meu CPF é 764.677.911-34"));
    }

    @Test
    void extraiCpfSomenteDigitosValido() {
        assertEquals("76467791134", CpfUtil.extrairCpfValido("76467791134"));
    }

    @Test
    void rejeitaCpfInvalido() {
        assertNull(CpfUtil.extrairCpfValido("111.111.111-11"));
        assertNull(CpfUtil.extrairCpfValido("123.456.789-00"));
    }

    @Test
    void validarCpfRejeitaSequenciaRepetida() {
        assertFalse(CpfUtil.validarCpf("11111111111"));
    }

    @Test
    void normalizarRetornaOnzeDigitos() {
        assertEquals("76467791134", CpfUtil.normalizar("764.677.911-34"));
        assertNull(CpfUtil.normalizar("1234567890"));
    }
}
