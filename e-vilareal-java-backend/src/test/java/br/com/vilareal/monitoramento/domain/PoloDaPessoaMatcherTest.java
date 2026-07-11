package br.com.vilareal.monitoramento.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PoloDaPessoaMatcherTest {

    @Test
    void normalizaMaiusculasAcentosPontuacaoESufixoSocietario() {
        assertEquals("SETTE TELECOM", PoloDaPessoaMatcher.normalizar("Sette Telecom Ltda"));
        assertEquals("SE77E TELECOM", PoloDaPessoaMatcher.normalizar("Se77E Telecom Eireli"));
        assertEquals("JOSE DA SILVA", PoloDaPessoaMatcher.normalizar("José da Silva"));
        assertEquals("BANCO DO BRASIL", PoloDaPessoaMatcher.normalizar("Banco do Brasil S.A."));
        assertEquals("ACME", PoloDaPessoaMatcher.normalizar("ACME LTDA - ME"));
        assertEquals("", PoloDaPessoaMatcher.normalizar(null));
        assertEquals("", PoloDaPessoaMatcher.normalizar("  "));
    }

    @Test
    void sufixoSoCaiComoTokenFinalIsoladoNuncaSubstring() {
        // "SA" é substring de SANTOS; "SA" também termina "CASA" — nada pode ser mutilado.
        assertEquals("ROSANA SANTOS", PoloDaPessoaMatcher.normalizar("ROSANA SANTOS"));
        assertEquals("CASA VERDE", PoloDaPessoaMatcher.normalizar("CASA VERDE"));

        // "ME" solto pode ser sobrenome — só cai quando o restante termina em sufixo forte.
        assertEquals("CASA GRANDE ME", PoloDaPessoaMatcher.normalizar("CASA GRANDE ME"));

        // Sufixos fortes como token final caem.
        assertEquals("TELECOM", PoloDaPessoaMatcher.normalizar("TELECOM LTDA"));
        assertEquals("SETTE", PoloDaPessoaMatcher.normalizar("SETTE S.A"));
    }

    @Test
    void casaPorIgualdadeNormalizada() {
        assertTrue(PoloDaPessoaMatcher.casaEmAlguma(
                "SETTE TELECOM LTDA", List.of("Sette Telecom Eireli")));
    }

    @Test
    void casaPorContinenciaComNomeTruncado() {
        // A lista do PROJUDI às vezes traz o nome incompleto.
        assertTrue(PoloDaPessoaMatcher.casaEmAlguma(
                "LEILA CARLA SILVA E RIBEIRO BORGES", List.of("Leila Carla Silva E Ribeiro")));
    }

    @Test
    void naoCasaNomesCurtosPorContinenciaTrivial() {
        assertFalse(PoloDaPessoaMatcher.casaEmAlguma("ANA", List.of("MARIANA COSTA")));
    }

    @Test
    void determinaPolosCorretamente() {
        assertEquals(PoloDaPessoa.ATIVO, PoloDaPessoaMatcher.determinar(
                "Maria Souza", List.of("MARIA SOUZA"), List.of("Banco X")));
        assertEquals(PoloDaPessoa.PASSIVO, PoloDaPessoaMatcher.determinar(
                "Maria Souza", List.of("Banco X"), List.of("MARIA SOUZA")));
        assertEquals(PoloDaPessoa.AMBOS, PoloDaPessoaMatcher.determinar(
                "Maria Souza", List.of("MARIA SOUZA"), List.of("maria souza")));
        // Razão social mudou → não casa em nenhum → INDETERMINADO (nunca descartado).
        assertEquals(PoloDaPessoa.INDETERMINADO, PoloDaPessoaMatcher.determinar(
                "Sette Telecom Ltda", List.of("Empresa Nova SA"), List.of("Outro Nome")));
    }

    @Test
    void descarteAutomaticoSoQuandoMonitoraPassivoEDetectouAtivoComCerteza() {
        assertTrue(PoloDaPessoaMatcher.descartarAutomaticamente("PASSIVO", PoloDaPessoa.ATIVO));

        // INDETERMINADO e AMBOS SEMPRE viram alerta — falso negativo custa uma citação.
        assertFalse(PoloDaPessoaMatcher.descartarAutomaticamente("PASSIVO", PoloDaPessoa.INDETERMINADO));
        assertFalse(PoloDaPessoaMatcher.descartarAutomaticamente("PASSIVO", PoloDaPessoa.AMBOS));
        assertFalse(PoloDaPessoaMatcher.descartarAutomaticamente("PASSIVO", PoloDaPessoa.PASSIVO));

        // Monitorando ATIVO ou AMBOS não há descarte automático nenhum.
        assertFalse(PoloDaPessoaMatcher.descartarAutomaticamente("ATIVO", PoloDaPessoa.PASSIVO));
        assertFalse(PoloDaPessoaMatcher.descartarAutomaticamente("AMBOS", PoloDaPessoa.ATIVO));
    }
}
