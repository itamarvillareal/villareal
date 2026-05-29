package br.com.vilareal.documento.parse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/** Valida o .docx de exemplo local (Downloads), se existir na máquina de desenvolvimento. */
class DocumentoDocxParserArquivoRealTest {

    private static final Path ARQUIVO =
            Path.of(System.getProperty("user.home"), "Downloads", "Justificativa_Ausencia_Audiencia.docx");

    @EnabledIf("arquivoDisponivel")
    @Test
    void parsear_arquivoJustificativa_naoDuplicaCabecalhoNoPreambulo() throws Exception {
        DocumentoDocxParser parser = new DocumentoDocxParser();
        DocumentoParseado r;
        try (var in = Files.newInputStream(ARQUIVO)) {
            r = parser.parsear(in);
        }

        assertThat(r.enderecoJuizo()).contains("EXCELENTÍSSIMO");
        assertThat(r.numeroProcesso()).isEqualTo("5009686-73.2026.8.09.0007");
        assertThat(r.nomePeca()).isEqualTo("JUSTIFICATIVA DE AUSÊNCIA EM AUDIÊNCIA");
        assertThat(r.preambulo()).isNotEmpty();
        assertThat(r.preambulo().get(0).textoPlano()).doesNotContain("EXCELENTÍSSIMO");
        assertThat(r.preambulo().get(0).textoPlano()).doesNotContain("Autos nº");
    }

    static boolean arquivoDisponivel() {
        return Files.isRegularFile(ARQUIVO);
    }
}
