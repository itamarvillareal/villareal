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

    @Test
    void reconheceNotificacaoProjudiOuTrt() {
        assertTrue(GmailCaixaOrdemService.ehNotificacaoMovimentacao(
                "[PROJUDI]Informação de intimação/citação", "encaminhado <eu@gmail.com>"));
        assertTrue(GmailCaixaOrdemService.ehNotificacaoMovimentacao(
                "Fwd: [TRT18] [PUSH] Atualizações", "eu@gmail.com"));
        assertTrue(GmailCaixaOrdemService.ehNotificacaoMovimentacao(
                "Atualização", "nao-responda@trt18.jus.br"));
        assertTrue(GmailCaixaOrdemService.ehNotificacaoMovimentacao(
                "[TRT18] [PUSH] Atualizações", "Processo Judicial Eletrônico <sistema@tjgo.jus.br>"));
        assertFalse(GmailCaixaOrdemService.ehNotificacaoMovimentacao(
                "Fatura cartão", "banco@itau.com.br"));
    }
}
