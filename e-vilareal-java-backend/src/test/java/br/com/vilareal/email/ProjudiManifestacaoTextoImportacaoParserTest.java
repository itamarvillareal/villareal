package br.com.vilareal.email;

import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiManifestacaoTextoImportacaoParserTest {

    @Test
    void parseTextoBruto_intimacaoComPartes() {
        String texto =
                """
                Processo: 5146573-67.2026.8.09.0006
                Movimentação: Expedição de intimação
                Data: 27/05/2026 14:30

                Autor: MEGA ELITE LTDA
                Réu: GLEISMAR SILVA SANTOS
                """;

        List<PublicacaoWriteRequest> itens =
                ProjudiManifestacaoTextoImportacaoParser.parseTextoBruto(
                        texto, "PROJUDI - Intimação processual", "teste [msg-p1]");

        assertEquals(1, itens.size());
        PublicacaoWriteRequest p = itens.get(0);
        assertEquals("5146573-67.2026.8.09.0006", p.getNumeroProcessoEncontrado());
        assertEquals(LocalDate.of(2026, 5, 27), p.getDataPublicacao());
        assertEquals("PROJUDI", p.getOrigemImportacao());
        assertTrue(p.getTipoPublicacao().toLowerCase().contains("intima"));
        assertNotNull(p.getJsonReferencia());
        assertTrue(p.getJsonReferencia().contains("MEGA ELITE"));
        assertTrue(p.getJsonReferencia().contains("GLEISMAR"));
    }

    @Test
    void parseTextoBruto_arquivamentoPeloAssunto() {
        String texto =
                """
                Número do Processo: 6047814-82.2025.8.09.0007
                Tipo de Movimentação: Arquivamento definitivo
                Data da movimentação: 20/03/2026
                """;

        List<PublicacaoWriteRequest> itens =
                ProjudiManifestacaoTextoImportacaoParser.parseTextoBruto(texto, "Arquivamento - Projudi", "teste [msg-p2]");

        assertEquals(1, itens.size());
        assertEquals("6047814-82.2025.8.09.0007", itens.get(0).getNumeroProcessoEncontrado());
        assertTrue(itens.get(0).getTipoPublicacao().toLowerCase().contains("arquiv"));
    }

    @Test
    void parseTextoBruto_assuntoInformacaoIntimacaoCitacao_semRotuloProcesso() {
        String texto =
                """
                Prezado(a),

                Informação de intimação/citação

                5146573-67.2026.8.09.0006

                Parte intimada: MEGA ELITE LTDA
                Réu: GLEISMAR SILVA SANTOS

                Data: 28/05/2026
                """;

        List<PublicacaoWriteRequest> itens =
                ProjudiManifestacaoTextoImportacaoParser.parseTextoBruto(
                        texto, "[PROJUDI]Informação de intimação/citação", "teste [msg-p4]");

        assertEquals(1, itens.size());
        assertEquals("5146573-67.2026.8.09.0006", itens.get(0).getNumeroProcessoEncontrado());
        assertEquals("Informação de intimação/citação", itens.get(0).getTipoPublicacao());
    }

    @Test
    void parseHtmlProjudi_cnjNoTextoPlanoComHtmlVazio() {
        String conteudo =
                """
                <html><body><p>Notificação Projudi</p></body></html>

                Informação de intimação/citação
                Processo: 5003185-74.2026.8.09.0001
                Parte intimada: SE77E TELECOM EIRELI ME
                """;

        List<PublicacaoWriteRequest> itens =
                ProjudiManifestacaoTextoImportacaoParser.parseHtmlProjudi(
                        conteudo,
                        "[PROJUDI]Informação de intimação/citação",
                        "teste [msg-plain]");

        assertEquals(1, itens.size());
        assertTrue(
                itens.stream().anyMatch(p -> "5003185-74.2026.8.09.0001".equals(p.getNumeroProcessoEncontrado())));
        assertEquals("Informação de intimação/citação", itens.get(0).getTipoPublicacao());
    }

    @Test
    void parseHtmlProjudi_cnjSomenteNoHref() {
        String html =
                """
                <html><body>
                <p>Informação de intimação/citação</p>
                <a href="https://projudi.tjgo.jus.br/ProcessoCivel?numeroProcesso=51711180720268090006">
                  Acessar processo
                </a>
                </body></html>
                """;

        List<PublicacaoWriteRequest> itens =
                ProjudiManifestacaoTextoImportacaoParser.parseHtmlProjudi(
                        html,
                        "[PROJUDI]Informação de intimação/citação - Sr(a). ADVOGADO",
                        "teste [msg-href]");

        assertEquals(1, itens.size());
        assertEquals("5171118-07.2026.8.09.0006", itens.get(0).getNumeroProcessoEncontrado());
        assertEquals("Informação de intimação/citação", itens.get(0).getTipoPublicacao());
    }

    @Test
    void parseTextoBruto_cnjNoAssuntoIntimacao() {
        List<PublicacaoWriteRequest> itens =
                ProjudiManifestacaoTextoImportacaoParser.parseTextoBruto(
                        "",
                        "[PROJUDI]Informação de intimação/citação - Sr(a). ITAMAR., O processo 5171118-07.2026.8.09.0006 foi intimado",
                        "teste [msg-subj]");

        assertEquals(1, itens.size());
        assertEquals("5171118-07.2026.8.09.0006", itens.get(0).getNumeroProcessoEncontrado());
        assertEquals("Informação de intimação/citação", itens.get(0).getTipoPublicacao());
    }

    @Test
    void parseTextoBruto_cnjEm20Digitos() {
        String texto =
                """
                Informação de intimação/citação
                Processo 51465736720268090006
                """;

        List<PublicacaoWriteRequest> itens =
                ProjudiManifestacaoTextoImportacaoParser.parseTextoBruto(
                        texto, "[PROJUDI]Informação de intimação/citação", "teste [msg-p5]");

        assertEquals(1, itens.size());
        assertEquals("5146573-67.2026.8.09.0006", itens.get(0).getNumeroProcessoEncontrado());
    }

    @Test
    void parseHtmlProjudi_naoRepeteTeorPlainHtml() {
        String plain =
                """
                Sr(a). ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR,

                O Poder Judiciário do Estado de Goiás informa que está disponível uma intimação/citação
                referente ao processo nº. 5852092.84 em sua caixa de entrada no Sistema PROJUDI.
                """;
        String html =
                """
                <html><body>
                <p>Sr(a). ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR,</p>
                <p>O Poder Judici&aacute;rio do Estado de Goi&aacute;s informa que est&aacute; dispon&iacute;vel
                uma intima&ccedil;&atilde;o/cita&ccedil;&atilde;o referente ao processo n&ordm;. 5852092.84</p>
                </body></html>
                """;
        String conteudo = plain + "\n\n" + html;

        List<PublicacaoWriteRequest> itens =
                ProjudiManifestacaoTextoImportacaoParser.parseHtmlProjudi(
                        conteudo, "[PROJUDI]Informação de intimação/citação", "teste [msg-dedup]");

        assertEquals(1, itens.size());
        String teor = itens.get(0).getTeor();
        assertTrue(teor.contains("5852092.84"));
        assertTrue(teor.contains("Poder Judiciário") || teor.contains("Poder Judici"));
        int idx = teor.indexOf("Sr(a). ITAMAR");
        assertTrue(idx >= 0, "deve conter início do texto");
        assertEquals(idx, teor.lastIndexOf("Sr(a). ITAMAR"), "não deve repetir o mesmo bloco");
    }

    @Test
    void parseTextoBruto_emailIntimacaoNumeroProjudiInterno_5868881_58() {
        String texto =
                """
                Sr(a). ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR,

                O Poder Judiciário do Estado de Goiás informa que está disponível uma intimação/citação
                referente ao processo nº. 5868881.58 em sua caixa de entrada no Sistema PROJUDI.

                Obs.: Esta mensagem não possui valor legal.

                Esta é um mensagem automática gerada às 28/05/2026 17:26:11.
                """;

        List<PublicacaoWriteRequest> itens =
                ProjudiManifestacaoTextoImportacaoParser.parseTextoBruto(
                        texto, "[PROJUDI]Informação de intimação/citação", "teste [msg-5868881]");

        assertEquals(1, itens.size());
        assertEquals("5868881.58", itens.get(0).getNumeroProcessoEncontrado());
        assertEquals("Informação de intimação/citação", itens.get(0).getTipoPublicacao());
        assertEquals(LocalDate.of(2026, 5, 28), itens.get(0).getDataPublicacao());
        assertTrue(itens.get(0).getJsonReferencia().contains("PROJUDI_INTERNO"));
        assertTrue(itens.get(0).getJsonReferencia().contains("5868881.58"));
    }

    @Test
    void parseHtmlProjudi_naoMultiplicaBlocoRepetidoComQuebrasSimples() {
        String bloco =
                "Sr(a). ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR,\n"
                        + " O Poder Judici&aacute;rio do Estado de Goi&aacute;s informa que est&aacute; dispon&iacute;vel"
                        + " uma intima&ccedil;&atilde;o/cita&ccedil;&atilde;o referente ao processo n&ordm;. 5868948.23"
                        + " em sua caixa de entrada no Sistema PROJUDI.\n"
                        + " Sistema PROJUDI\n"
                        + " Obs.: Esta mensagem n&atilde;o possui valor legal.\n"
                        + " Esta &eacute; um mensagem autom&aacute;tica gerada &agrave;s 28/05/2026 23:00:25.\n"
                        + " Por favor n&atilde;o responder esta mensagem.";
        String conteudo = bloco + "\n\n" + bloco + "\n" + bloco + "\n\n" + bloco;

        List<PublicacaoWriteRequest> itens =
                ProjudiManifestacaoTextoImportacaoParser.parseHtmlProjudi(
                        conteudo, "[PROJUDI]Informação de intimação/citação", "teste [msg-multi]");

        assertEquals(1, itens.size());
        String teor = itens.get(0).getTeor();
        assertEquals("5868948.23", itens.get(0).getNumeroProcessoEncontrado());
        assertEquals(
                teor.indexOf("Por favor"),
                teor.lastIndexOf("Por favor"),
                "não deve repetir o bloco do email: " + teor);
        assertEquals(
                teor.indexOf("Sistema PROJUDI"),
                teor.lastIndexOf("Sistema PROJUDI"),
                "não deve repetir 'Sistema PROJUDI': " + teor);
    }

    @Test
    void parseTextoBruto_doisProcessosNoMesmoEmail() {
        String texto =
                """
                Processo: 1111111-11.2024.8.09.0001
                Movimentação: Despacho
                Data: 01/01/2026

                Processo: 2222222-22.2024.8.09.0002
                Movimentação: Intimação
                Data: 02/01/2026
                """;

        List<PublicacaoWriteRequest> itens =
                ProjudiManifestacaoTextoImportacaoParser.parseTextoBruto(texto, "Movimentações", "teste [msg-p3]");

        assertEquals(2, itens.size());
        assertEquals("1111111-11.2024.8.09.0001", itens.get(0).getNumeroProcessoEncontrado());
        assertEquals("2222222-22.2024.8.09.0002", itens.get(1).getNumeroProcessoEncontrado());
    }
}
