package br.com.vilareal.projudi;

import br.com.vilareal.projudi.application.ProjudiInicialAssinaturaService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProjudiInicialAssinaturaServiceTest {

    @Test
    void chaveNumeroProcessoInicial_normalizaCodigo() {
        assertEquals(
                "INICIAL-00000001-42",
                ProjudiInicialAssinaturaService.chaveNumeroProcessoInicial("1", 42));
        assertEquals(
                "INICIAL-00000123-7",
                ProjudiInicialAssinaturaService.chaveNumeroProcessoInicial("123", 7));
    }

    @Test
    void chaveNumeroProcessoInicial_rejeitaVazio() {
        assertThrows(
                Exception.class,
                () -> ProjudiInicialAssinaturaService.chaveNumeroProcessoInicial("", 1));
    }
}
