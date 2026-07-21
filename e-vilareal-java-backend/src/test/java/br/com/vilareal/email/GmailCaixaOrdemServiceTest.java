package br.com.vilareal.email;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class GmailCaixaOrdemServiceTest {

    @Test
    void extraiMessageIdDoSufixoArquivoOrigem() {
        assertEquals(
                "19f58aab90524773",
                GmailCaixaOrdemService.extrairGmailMessageId(
                        "[PROJUDI]Informação de intimação/citação [19f58aab90524773]"));
        assertEquals(
                "19f5b4775761a4fb",
                GmailCaixaOrdemService.extrairGmailMessageId(
                        "[TRT18] [PUSH] Atualizações [19F5B4775761A4FB]  "));
    }

    @Test
    void semSufixoMessageIdRetornaNull() {
        assertNull(GmailCaixaOrdemService.extrairGmailMessageId(null));
        assertNull(GmailCaixaOrdemService.extrairGmailMessageId(""));
        assertNull(GmailCaixaOrdemService.extrairGmailMessageId("publicacao-manual.pdf"));
        assertNull(GmailCaixaOrdemService.extrairGmailMessageId("assunto [abc]"));
    }
}
