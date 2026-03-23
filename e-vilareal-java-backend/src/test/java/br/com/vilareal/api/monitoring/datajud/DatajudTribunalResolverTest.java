package br.com.vilareal.api.monitoring.datajud;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DatajudTribunalResolverTest {

    private final DatajudTribunalResolver resolver = new DatajudTribunalResolver();

    @Test
    void tjgo() {
        var o = resolver.resolveByCnj("5120280-57.2026.8.09.0007");
        assertTrue(o.isPresent());
        assertEquals("TJGO", o.get().sigla());
        assertEquals("api_publica_tjgo", o.get().apiIndex());
    }

    @Test
    void trt18() {
        var o = resolver.resolveByCnj("0011871-02.2024.5.18.0053");
        assertTrue(o.isPresent());
        assertEquals("TRT18", o.get().sigla());
        assertEquals("api_publica_trt18", o.get().apiIndex());
    }
}
