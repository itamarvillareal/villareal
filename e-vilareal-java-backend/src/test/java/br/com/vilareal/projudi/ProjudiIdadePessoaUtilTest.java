package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiIdadePessoaUtilTest {

    @Test
    void maiorDe60Anos_completou60() {
        LocalDate ref = LocalDate.of(2026, 7, 22);
        assertTrue(ProjudiIdadePessoaUtil.maiorDe60Anos(LocalDate.of(1966, 7, 22)));
        assertTrue(ProjudiIdadePessoaUtil.maiorDe60Anos(LocalDate.of(1960, 1, 1)));
    }

    @Test
    void maiorDe60Anos_aindaNaoCompletou60() {
        assertFalse(ProjudiIdadePessoaUtil.maiorDe60Anos(LocalDate.of(1966, 7, 23)));
        assertFalse(ProjudiIdadePessoaUtil.maiorDe60Anos(LocalDate.of(2000, 5, 10)));
    }

    @Test
    void maiorDe60Anos_semData() {
        assertFalse(ProjudiIdadePessoaUtil.maiorDe60Anos(null));
    }
}
