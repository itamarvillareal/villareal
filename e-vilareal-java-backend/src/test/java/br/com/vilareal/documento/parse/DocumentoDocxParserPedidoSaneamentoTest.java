package br.com.vilareal.documento.parse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoDocxParserPedidoSaneamentoTest {
    private static final Path ARQUIVO = Path.of(
            System.getProperty("user.home"),
            "Downloads",
            "Pedido_Ajuste_Saneamento_art357p1_6003951-79.docx");

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
