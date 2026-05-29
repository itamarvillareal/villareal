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
