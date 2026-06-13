package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class FinanceiroCadastroPlenitudeTest {

    @Test
    void normalizarFiltro_aceitaPlenoOuParcial() {
        assertEquals(FinanceiroCadastroPlenitude.PLENO, FinanceiroCadastroPlenitude.normalizarFiltro("pleno"));
        assertEquals(FinanceiroCadastroPlenitude.PARCIAL, FinanceiroCadastroPlenitude.normalizarFiltro("PARCIAL"));
        assertNull(FinanceiroCadastroPlenitude.normalizarFiltro(null));
        assertNull(FinanceiroCadastroPlenitude.normalizarFiltro("outro"));
    }
}
