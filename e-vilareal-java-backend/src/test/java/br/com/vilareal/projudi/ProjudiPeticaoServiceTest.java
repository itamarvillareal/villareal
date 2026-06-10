package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiPeticaoServiceTest {

    @Test
    void resolverNomeArquivoUpload_usaNomeOriginalQuandoInformado() {
        String nome = ProjudiPeticaoService.resolverNomeArquivoUpload(
                "Peticao_Cumprimento_5403580.pdf.p7s", "5487866-77.2022.8.09.0007", 1L, 0);
        assertEquals("Peticao_Cumprimento_5403580.pdf.p7s", nome);
    }

    @Test
    void resolverNomeArquivoUpload_fallbackPdfP7s() {
        String nome = ProjudiPeticaoService.resolverNomeArquivoUpload(
                null, "5487866-77.2022.8.09.0007", 123L, 2);
        assertTrue(nome.endsWith(".pdf.p7s"));
        assertTrue(nome.startsWith("peticao_54878667720228090007_123_2"));
    }

    @Test
    void encFormComponent_codificaMaisComoPercent2B() {
        String encoded = ProjudiPeticaoService.encFormComponent("data:application/pkcs7-signature;base64,ABC+DEF/GHI=");
        assertTrue(encoded.contains("%2B"), encoded);
        assertTrue(!encoded.contains("+"), encoded);
    }

    @Test
    void protocoloConfirmado_aceitaRedirectComMaisNaUrl() {
        String location =
                "https://projudi.tjgo.jus.br/BuscaProcesso?MensagemOk=Peti%C3%A7%C3%A3o+enviada+com+sucesso.";
        assertTrue(ProjudiPeticaoService.protocoloConfirmadoParaTeste(location, ""));
    }
}
