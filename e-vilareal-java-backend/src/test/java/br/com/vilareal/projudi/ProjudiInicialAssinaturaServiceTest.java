package br.com.vilareal.projudi;

import br.com.vilareal.projudi.application.ProjudiInicialAssinaturaService;
import br.com.vilareal.common.exception.BusinessRuleException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

    @Test
    void ehChaveInicialDistribuicao_reconhecePrefixo() {
        assertTrue(ProjudiInicialAssinaturaService.ehChaveInicialDistribuicao("INICIAL-00000299-28"));
        assertTrue(ProjudiInicialAssinaturaService.ehChaveInicialDistribuicao("inicial-1-7"));
        assertFalse(ProjudiInicialAssinaturaService.ehChaveInicialDistribuicao("5589985-77.2026.8.09.0007"));
        assertFalse(ProjudiInicialAssinaturaService.ehChaveInicialDistribuicao(null));
        assertFalse(ProjudiInicialAssinaturaService.ehChaveInicialDistribuicao("  "));
    }

    @Test
    void exigirNaoEhInicialDistribuicao_bloqueiaInicial() {
        BusinessRuleException ex =
                assertThrows(
                        BusinessRuleException.class,
                        () ->
                                ProjudiInicialAssinaturaService.exigirNaoEhInicialDistribuicao(
                                        "INICIAL-00000299-28", 153L));
        assertEquals(
                "Petição #153 é de distribuição de inicial (INICIAL-00000299-28). "
                        + "Use Processos → Distribuir Inicial PROJUDI — não Peticionamento PROJUDI.",
                ex.getMessage());
    }
}
