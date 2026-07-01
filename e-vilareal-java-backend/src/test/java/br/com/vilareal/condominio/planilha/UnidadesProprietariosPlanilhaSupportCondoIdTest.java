package br.com.vilareal.condominio.planilha;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UnidadesProprietariosPlanilhaSupportCondoIdTest {

    @Test
    void parseEnderecoTextoLivre_extraiCidadeUfELogradouro() {
        var e = UnidadesProprietariosPlanilhaSupport.parseEnderecoTextoLivre(
                "Rua CP18 Carolina Parque Goiânia - GO");
        assertEquals("GO", e.uf());
        assertEquals("Goiânia", e.cidade());
        assertTrue(e.logradouro().contains("Rua CP18"));
    }

    @Test
    void splitTelefonesEspacoOuSeparador_separaVariosNumeros() {
        var fones = UnidadesProprietariosPlanilhaSupport.splitTelefonesEspacoOuSeparador("62993577341 62992499827");
        assertEquals(2, fones.size());
    }

    @Test
    void normalizarCodigoUnidade_preservaQuadraLoteCondoId() {
        assertEquals("QD01-LT01", UnidadesProprietariosPlanilhaSupport.normalizarCodigoUnidade("qd01-lt01"));
    }
}
