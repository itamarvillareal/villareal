package br.com.vilareal.api.monitoring.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CnjFormatUtilTest {

    @Test
    void extractFromText() {
        var o = CnjFormatUtil.extractFirstCnj("Processo 5120280-57.2026.8.09.0007 no TJGO");
        assertTrue(o.isPresent());
        assertEquals("5120280-57.2026.8.09.0007", o.get());
    }
}
