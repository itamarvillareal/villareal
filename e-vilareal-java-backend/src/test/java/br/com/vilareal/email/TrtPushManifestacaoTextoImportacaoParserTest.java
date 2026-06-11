package br.com.vilareal.email;

import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TrtPushManifestacaoTextoImportacaoParserTest {

    private static final String ASSUNTO =
            "[TRT18] [PUSH] Atualizações de Informações Processuais do Processo 0012039-98.2024.5.18.0054";

    @Test
    void parse_pushTrt18_extraiProcessoEMetadados() {
        String corpo =
                """
                Processo Judicial Eletrônico
                Tribunal Regional do Trabalho da 18ª Região - 1º Grau
                Acompanhamento de Atualizações de Informações Processuais
                Prezado(a) ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR,
                Informamos que o processo a seguir sofreu movimentação:
                Número do Processo: 0012039-98.2024.5.18.0054
                Classe Judicial: Ação Trabalhista - Rito Sumaríssimo
                Órgão Julgador: 4ª VARA DO TRABALHO DE ANÁPOLIS
                Data de Autuação: 11/12/2024 15:56:12
                Autor: JOSE GUILHERME DE PAULA BRAGA
                Réu: CONDOMINIO TERRA MUNDI ANAPOLIS
                Última Movimentação: Conclusos para julgamento
                """;

        List<PublicacaoWriteRequest> itens =
                TrtPushManifestacaoTextoImportacaoParser.parse(corpo, ASSUNTO, "assunto [msg-trt-1]", null);

        assertEquals(1, itens.size());
        PublicacaoWriteRequest p = itens.get(0);
        assertEquals("0012039-98.2024.5.18.0054", p.getNumeroProcessoEncontrado());
        assertEquals("TRT", p.getOrigemImportacao());
        assertEquals("TRT18", p.getDiario());
        assertTrue(p.getFonte().contains("18"));
        assertTrue(p.getTipoPublicacao().toLowerCase().contains("conclusos"));
        assertNotNull(p.getJsonReferencia());
        assertTrue(p.getJsonReferencia().contains("\"trt\""));
        assertTrue(p.getJsonReferencia().contains("JOSE GUILHERME"));
        assertTrue(p.getJsonReferencia().contains("CONDOMINIO TERRA MUNDI"));
    }

    @Test
    void parse_semMovimentacaoUsaTipoPadrao() {
        String corpo =
                """
                Número do Processo: 0012039-98.2024.5.18.0054
                Classe Judicial: Ação Trabalhista
                Autor: FULANO DE TAL
                """;

        List<PublicacaoWriteRequest> itens =
                TrtPushManifestacaoTextoImportacaoParser.parse(corpo, ASSUNTO, "assunto [msg-trt-2]", null);

        assertEquals(1, itens.size());
        assertEquals("Atualização processual (PUSH)", itens.get(0).getTipoPublicacao());
    }

    @Test
    void parse_htmlComStyle_naoGravaCssNoTeor() {
        String html =
                """
                <html><head><style>
                * { margin: 0; padding: 0; }
                body { background: #fff; font-size: 100%; }
                table { color: #000; font-size: 10px; }
                </style></head><body>
                <p>Número do Processo: 0000545-17.2025.5.18.0051</p>
                <p>Classe Judicial: Ação Trabalhista - Rito Sumaríssimo</p>
                <p>Órgão Julgador: 1ª VARA DO TRABALHO DE GOIÂNIA</p>
                <p>Autor: EZEQUIEL DOS SANTOS FERREIRA</p>
                <p>Réu: MEGA ELITE VIGILANCIA E SEGURANÇA ESPECIALIZADA LTDA</p>
                <p>Última Movimentação: Intimação</p>
                </body></html>
                """;

        List<PublicacaoWriteRequest> itens =
                TrtPushManifestacaoTextoImportacaoParser.parse(
                        html,
                        "[TRT18] [PUSH] Atualizações de Informações Processuais do Processo 0000545-17.2025.5.18.0051",
                        "assunto [msg-trt-html]",
                        null);

        assertEquals(1, itens.size());
        String teor = itens.get(0).getTeor();
        assertNotNull(teor);
        assertTrue(teor.contains("Número do Processo: 0000545-17.2025.5.18.0051"));
        assertTrue(teor.contains("MEGA ELITE VIGILANCIA"));
        assertFalse(teor.contains("margin: 0"));
        assertFalse(teor.contains("font-size: 10px"));
    }

    @Test
    void parse_cnjApenasNoAssunto() {
        List<PublicacaoWriteRequest> itens =
                TrtPushManifestacaoTextoImportacaoParser.parse(
                        "Corpo sem número de processo legível.", ASSUNTO, "assunto [msg-trt-3]", null);

        assertEquals(1, itens.size());
        assertEquals("0012039-98.2024.5.18.0054", itens.get(0).getNumeroProcessoEncontrado());
    }
}
