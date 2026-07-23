package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
    void resolverNomeArquivoUpload_normalizaP7sSemPdf() {
        String nome = ProjudiPeticaoService.resolverNomeArquivoUpload(
                "01._peticaoexecucao0000029928_1.p7s", "inicial", 1L, 0);
        assertEquals("01._peticaoexecucao0000029928_1.pdf.p7s", nome);
    }

    @Test
    void normalizarNomeP7sParaUpload_preservaPdfP7s() {
        assertEquals(
                "Peticao.pdf.p7s",
                ProjudiPeticaoService.normalizarNomeP7sParaUpload("Peticao.pdf.p7s"));
    }

    @Test
    void normalizarNomeP7sParaUpload_converteNfdParaNfcLatin1() {
        // "LOCAÇÃO" em NFD (C + cedilha combinante + A + til combinante) — causa «Problema no pedido»
        String nfd = "09.FICHA DE LOCA" + "C\u0327" + "A\u0303" + "O.pdf.p7s";
        String normalizado = ProjudiPeticaoService.normalizarNomeP7sParaUpload(nfd);
        assertEquals("09.FICHA DE LOCAÇÃO.pdf.p7s", normalizado);
        assertTrue(java.nio.charset.StandardCharsets.ISO_8859_1.newEncoder().canEncode(normalizado));
        String corpo = ProjudiProcessoCivelInicialCorpoUtil.montarCorpoConcluirAnexos(java.util.List.of(normalizado));
        assertTrue(corpo.contains("LOCA%C7%C3O"), corpo);
        assertFalse(corpo.contains("%3F"), corpo);
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

    @Test
    void resolverCorpoPasso11_extraiPedidoDoHtml() {
        String html =
                """
                <form>
                <input name="PaginaAtual" type="hidden" value="5">
                <input id="__Pedido__" name="__Pedido__" type="hidden" value="987654321">
                </form>
                """;
        String corpo = ProjudiPeticaoService.resolverCorpoPasso11(html);
        assertEquals(
                "PaginaAtual=5&__Pedido__=987654321&PaginaAnterior=-2&TituloPagina=null&imgConcluir=Concluir",
                corpo);
    }

    @Test
    void resolverCorpoPasso11_comUrgenciaELiberdade() {
        String html =
                """
                <form>
                <input id="__Pedido__" name="__Pedido__" type="hidden" value="111">
                <input type="checkbox" name="Urgente" value="true"> Envolve pedido de urgência
                <label><input type="checkbox" name="PedidoLiberdade" value="true"> Pedido de Liberdade</label>
                </form>
                """;
        String corpo = ProjudiPeticaoService.resolverCorpoPasso11(
                html, new ProjudiPeticaoOpcoesConfirmacao(true, true));
        assertTrue(corpo.contains("__Pedido__=111"), corpo);
        assertTrue(corpo.contains("&Urgente=true"), corpo);
        assertTrue(corpo.contains("&PedidoLiberdade=true"), corpo);
    }

    @Test
    void resolverCorpoPasso11_ignoraPedidoNull() {
        String html = "<input name=\"__Pedido__\" type=\"hidden\" value=\"null\" />";
        assertEquals(null, ProjudiPeticaoService.resolverCorpoPasso11(html));
    }

    @Test
    void normalizarTextoMovimentacaoProjudi_preservaLatin1() {
        assertEquals(
                "Indicação Prioridade e Juntada Caução",
                ProjudiPeticaoService.normalizarTextoMovimentacaoProjudi(
                        "Indicação Prioridade e Juntada Caução"));
    }

    @Test
    void normalizarTextoMovimentacaoProjudi_removeEmoji() {
        assertEquals(
                "Petição urgente _",
                ProjudiPeticaoService.normalizarTextoMovimentacaoProjudi("Petição urgente 🚨"));
    }

    @Test
    void normalizarTextoMovimentacaoProjudi_preservaAcentosIso88591() {
        assertEquals(
                "Petição Urgente - cancelamento sessao cejusc",
                ProjudiPeticaoService.normalizarTextoMovimentacaoProjudi(
                        "Petição Urgente - cancelamento sessao cejusc"));
    }
}
