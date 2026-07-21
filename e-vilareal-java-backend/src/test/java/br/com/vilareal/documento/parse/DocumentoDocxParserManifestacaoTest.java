package br.com.vilareal.documento.parse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/** Valida o .docx de impugnação com cronograma em tabela, se existir localmente. */
class DocumentoDocxParserManifestacaoTest {

    private static final Path ARQUIVO = Path.of(
            System.getProperty("user.home"),
            "Downloads",
            "Manifestacao_Impugnacao_Contraproposta_Alex.docx");

    @EnabledIf("arquivoDisponivel")
    @Test
    void parsear_manifestacao_incluiTabelaDoItemIii() throws Exception {
        DocumentoDocxParser parser = new DocumentoDocxParser();
        DocumentoParseado r;
        try (var in = Files.newInputStream(ARQUIVO)) {
            r = parser.parsear(in);
        }

        SecaoDocumento secaoIii = r.secoes().stream()
                .filter(s -> s.titulo() != null && s.titulo().toUpperCase().contains("III"))
                .findFirst()
                .orElseThrow();

        assertThat(secaoIii.paragrafos()).anyMatch(p -> p.tipo() == TipoParagrafo.TABELA);
        assertThat(secaoIii.paragrafos().stream()
                        .filter(p -> p.tipo() == TipoParagrafo.TABELA)
                        .findFirst()
                        .orElseThrow()
                        .textoPlano())
                .contains("Parcela")
                .contains("4.748,71");
    }

    static boolean arquivoDisponivel() {
        return Files.isRegularFile(ARQUIVO);
    }
}
