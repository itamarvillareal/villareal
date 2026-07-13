package br.com.vilareal.email;

import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.Thread;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

    @Test
    void mensagemRepresentanteThread_usaMensagemMaisRecente() {
        Message antiga = new Message();
        antiga.setInternalDate(Instant.parse("2026-07-04T06:02:27Z").toEpochMilli());
        Message recente = new Message();
        recente.setInternalDate(Instant.parse("2026-07-13T00:14:05Z").toEpochMilli());
        Thread thread = new Thread().setMessages(List.of(antiga, recente));

        Message rep = GmailCaixaOrdemService.mensagemRepresentanteThread(thread);
        assertEquals(recente, rep);
    }
}
