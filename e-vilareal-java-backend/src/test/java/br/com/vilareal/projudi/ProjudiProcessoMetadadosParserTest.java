package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiProcessoMetadadosParserTest {

    @Test
    void extrairDataDistribuicao_deHtmlCapturado() throws Exception {
        Path fixture = Path.of(
                "../e-vilareal-react-web/projudi-peticao-capture/bodies/"
                        + "0222_projudi_tjgo_jus_br_BuscaProcesso_Id_Processo_613081756229290873912418764_PassoB.html");
        String html = Files.readString(fixture);

        assertThat(ProjudiProcessoMetadadosParser.extrairDataDistribuicao(html))
                .contains(LocalDate.of(2025, 12, 12));
    }

    @Test
    void extrairDataDistribuicao_deSnippetInline() {
        String html =
                """
                <div> Dt. Distribui&ccedil;&atilde;o</div>
                <span class="span3">20/03/2024 00:00:00</span>
                """;

        assertThat(ProjudiProcessoMetadadosParser.extrairDataDistribuicao(html))
                .contains(LocalDate.of(2024, 3, 20));
    }

    @Test
    void extrairDataDistribuicao_retornaVazioQuandoAusente() {
        assertThat(ProjudiProcessoMetadadosParser.extrairDataDistribuicao("<html><body></body></html>"))
                .isEmpty();
    }
}
