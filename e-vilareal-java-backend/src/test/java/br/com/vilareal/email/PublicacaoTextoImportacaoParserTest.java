package br.com.vilareal.email;

import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PublicacaoTextoImportacaoParserTest {

    @Test
    void htmlParaTexto_removeStyleScriptECssSolto() {
        String html =
                """
                <style>* { margin: 0; padding: 0; }</style>
                <p>Número do Processo: 0000545-17.2025.5.18.0051</p>
                """;
        String texto = PublicacaoTextoImportacaoParser.htmlParaTexto(html);
        assertTrue(texto.contains("Número do Processo"));
        assertTrue(!texto.contains("margin: 0"));
    }

    private static String bloco(
            String processo,
            String dataDisp,
            String dataPub,
            String diario,
            String termos,
            String teor) {
        return """
                Processo %s
                Termos encontrados %s
                Data de disponibilização %s
                Data de publicação %s
                Diário %s
                Publicação
                %s
                """
                .formatted(processo, termos, dataDisp, dataPub, diario, teor);
    }

    @Test
    void parseTextoBruto_processoECnjCitadosNoTeor_semTermosEncontrados_naoSegmentaBlocoExtra() {
        String texto =
                bloco(
                        "5146573-67.2026.8.09.0006",
                        "25/05/2026",
                        "26/05/2026",
                        "Diário TJGO",
                        "termo",
                        """
                        Conforme Processo 6047814-82.2025.8.09.0007 e Processo 6048257-33.2025.8.09.0007
                        e Processo 5080120-90.2026.8.09.0006 citados na fundamentação.
                        """);

        List<PublicacaoWriteRequest> itens = PublicacaoTextoImportacaoParser.parseTextoBruto(texto, "teste [msg0]");

        assertEquals(1, itens.size());
        assertEquals("5146573-67.2026.8.09.0006", itens.get(0).getNumeroProcessoEncontrado());
        assertTrue(itens.get(0).getJsonReferencia().contains("6047814-82.2025.8.09.0007"));
    }

    @Test
    void parseTextoBruto_cnjApenasNoTeor_naoGeraPublicacaoPrincipal() {
        String texto =
                bloco(
                        "5146573-67.2026.8.09.0006",
                        "26/05/2026",
                        "26/05/2026",
                        "Diário TJGO",
                        "termo x",
                        """
                        Referência aos processos 6047814-82.2025.8.09.0007 e 6048257-33.2025.8.09.0007
                        e ainda 5080120-90.2026.8.09.0006, 5827899-34.2025.8.09.0006.
                        """);

        List<PublicacaoWriteRequest> itens = PublicacaoTextoImportacaoParser.parseTextoBruto(texto, "teste [msg1]");

        assertEquals(1, itens.size());
        assertEquals("5146573-67.2026.8.09.0006", itens.get(0).getNumeroProcessoEncontrado());
        assertEquals(LocalDate.of(2026, 5, 26), itens.get(0).getDataPublicacao());
        assertNotNull(itens.get(0).getJsonReferencia());
        assertTrue(itens.get(0).getJsonReferencia().contains("6047814-82.2025.8.09.0007"));
        assertTrue(itens.get(0).getJsonReferencia().contains("5080120-90.2026.8.09.0006"));
    }

    @Test
    void parseTextoBruto_mesmoProcessoDoisBlocosDistintos_geraDuasPublicacoes() {
        String texto =
                bloco(
                        "5146573-67.2026.8.09.0006",
                        "26/05/2026",
                        "26/05/2026",
                        "TJGO",
                        "a",
                        "Teor da primeira publicação do processo B com conteúdo suficiente.")
                        + bloco(
                                "5146573-67.2026.8.09.0006",
                                "26/05/2026",
                                "26/05/2026",
                                "TJGO",
                                "b",
                                "Teor da segunda publicação do mesmo processo com texto diferente.");

        List<PublicacaoWriteRequest> itens = PublicacaoTextoImportacaoParser.parseTextoBruto(texto, "teste [msg2]");

        assertEquals(2, itens.size());
        Set<String> hashes =
                itens.stream().map(PublicacaoWriteRequest::getHashTeor).collect(Collectors.toSet());
        assertEquals(2, hashes.size());
        assertEquals(
                1,
                itens.stream()
                        .map(PublicacaoWriteRequest::getNumeroProcessoEncontrado)
                        .distinct()
                        .count());
    }

    @Test
    void parseTextoBruto_vinteBlocos_noveProcessosUnicos_semFalsosPositivosNoTeor() {
        List<String> principais = List.of(
                "5431894-04.2026.8.09.0001",
                "5146573-67.2026.8.09.0006",
                "5252435-24.2026.8.09.0007",
                "5777715-42.2023.8.09.0007",
                "5559550-96.2021.8.09.0007",
                "5812298-82.2025.8.09.0007",
                "5275390-14.2026.8.09.0051",
                "5002523-42.2026.8.09.0007",
                "5009686-73.2026.8.09.0007",
                "6070102-97.2025.8.09.0112",
                "5161302-16.2026.8.09.0001",
                "5063401-98.2024.8.09.0007",
                "5943661-95.2025.8.09.0007",
                "5456802-10.2026.8.09.0007",
                "5003178-82.2024.8.09.0007",
                "5509763-30.2023.8.09.0007",
                "5143696-57.2026.8.09.0006",
                "5869239-23.2023.8.09.0007",
                "6104696-98.2024.8.09.0007");

        StringBuilder sb = new StringBuilder("20 novas publicações encontradas\n");
        for (int i = 0; i < principais.size(); i++) {
            String p = principais.get(i);
            String teor = "Teor da publicação " + (i + 1) + " do processo " + p + ".";
            if ("5146573-67.2026.8.09.0006".equals(p)) {
                teor =
                        """
                        Referência 6047814-82.2025.8.09.0007, 6048257-33.2025.8.09.0007,
                        5080120-90.2026.8.09.0006, 5827899-34.2025.8.09.0006, 5704688-58.2025.8.09.0006,
                        5527532-83.2025.8.09.0006, 5139965-53.2026.8.09.0006, 5535451-45.2023.8.09.0087.
                        Julgamento em 15/03/2020 não deve ser data de publicação.
                        """;
            }
            sb.append(bloco(p, "25/05/2026", "26/05/2026", "Diário TJGO", "termo", teor));
        }
        sb.append(bloco(
                "5146573-67.2026.8.09.0006",
                "25/05/2026",
                "26/05/2026",
                "Diário TJGO",
                "termo2",
                "Segunda publicação distinta do processo 5146573-67.2026.8.09.0006 no mesmo email."));

        List<PublicacaoWriteRequest> itens = PublicacaoTextoImportacaoParser.parseTextoBruto(sb.toString(), "teste [msg3]");

        assertEquals(20, itens.size(), "deve haver 20 blocos principais");

        Set<String> cnjsPrincipais = itens.stream()
                .map(PublicacaoWriteRequest::getNumeroProcessoEncontrado)
                .collect(Collectors.toSet());
        assertEquals(19, cnjsPrincipais.size(), "19 processos principais únicos");

        List<String> falsosPositivos = List.of(
                "6047814-82.2025.8.09.0007",
                "6048257-33.2025.8.09.0007",
                "5080120-90.2026.8.09.0006",
                "5827899-34.2025.8.09.0006",
                "5704688-58.2025.8.09.0006",
                "5527532-83.2025.8.09.0006",
                "5139965-53.2026.8.09.0006",
                "5535451-45.2023.8.09.0087");
        for (String falso : falsosPositivos) {
            assertFalse(cnjsPrincipais.contains(falso), "CNJ citado no teor não deve ser publicação principal: " + falso);
        }

        long vezes5146573 = itens.stream()
                .filter(p -> "5146573-67.2026.8.09.0006".equals(p.getNumeroProcessoEncontrado()))
                .count();
        assertEquals(2, vezes5146573);

        for (PublicacaoWriteRequest item : itens) {
            assertEquals(LocalDate.of(2026, 5, 26), item.getDataPublicacao());
        }
    }
}
