package br.com.vilareal.email;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GmailCaixaOrdemServiceTest {

    @Test
    void ignoraOtpProjudiNaOrdemDaCaixa() {
        assertTrue(GmailCaixaOrdemService.emailIgnoradoNaCaixa("[PROJUDI] Segurança: Código de Verificação"));
        assertTrue(GmailCaixaOrdemService.emailIgnoradoNaCaixa("[PROJUDI] Seguranca: Codigo de Verificacao"));
        assertFalse(GmailCaixaOrdemService.emailIgnoradoNaCaixa("[PROJUDI]Informação de intimação/citação"));
        assertFalse(GmailCaixaOrdemService.emailIgnoradoNaCaixa("[TRT18] [PUSH] Atualizações"));
    }
}
