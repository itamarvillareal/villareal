package br.com.vilareal.documento.parse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoDocxParserPedidoSaneamentoTest {
    private static final Path ARQUIVO = Path.of(
            System.getProperty("user.home"),
            "Downloads",
            "Pedido_Ajuste_Saneamento_art357p1_6003951-79.docx");

    @EnabledIf("arquivoDisponivel")
    @Test
    void parsear_pedidoSaneamento_preservaRecuoPrimeiraLinha() throws Exception {
        DocumentoDocxParser parser = new DocumentoDocxParser();
        DocumentoParseado r;
        try (var in = Files.newInputStream(ARQUIVO)) {
            r = parser.parsear(in);
        }

        List<ParagrafoDocumento> todos = new ArrayList<>(r.preambulo());
        r.secoes().forEach(s -> todos.addAll(s.paragrafos()));

        assertThat(todos.stream().filter(p -> p.estiloCss() != null && p.estiloCss().contains("text-indent")))
                .isNotEmpty()
                .anyMatch(p -> p.estiloCss().contains("2.50cm"));

        ParagrafoDocumento corpo = todos.stream()
                .filter(p -> p.estiloCss() != null && p.estiloCss().contains("text-indent: 2.50cm"))
                .findFirst()
                .orElseThrow();

        String html = DocumentoParagrafoHtmlUtil.paragrafoToHtml(corpo);
        assertThat(html).contains("text-indent: 2.50cm");
    }

    @EnabledIf("arquivoDisponivel")
    @Test
    void parsear_pedidoSaneamento_reconheceEnderecamentoFeminino() throws Exception {
        DocumentoDocxParser parser = new DocumentoDocxParser();
        DocumentoParseado r;
        try (var in = Files.newInputStream(ARQUIVO)) {
            r = parser.parsear(in);
        }
        assertThat(r.enderecoJuizo()).contains("EXCELENTÍSSIMA");
        assertThat(r.numeroProcesso()).isEqualTo("6003951-79.2025.8.09.0006");
        assertThat(r.preambulo()).isNotEmpty();
        assertThat(r.preambulo().get(0).textoPlano()).doesNotContain("EXCELENTÍSSIMA");
    }

    static boolean arquivoDisponivel() {
        return Files.isRegularFile(ARQUIVO);
    }
}
