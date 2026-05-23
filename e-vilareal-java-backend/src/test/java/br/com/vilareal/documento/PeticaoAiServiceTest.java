package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PeticaoAiServiceTest {

    @Test
    void limparJsonMarkdown_removeBackticks() {
        String entrada = """
                ```json
                {"preambulo":"x","secoes":[],"pedidos":["a"]}
                ```
                """;
        String limpo = PeticaoAiService.limparJsonMarkdown(entrada);
        assertThat(limpo).isEqualTo("{\"preambulo\":\"x\",\"secoes\":[],\"pedidos\":[\"a\"]}");
    }

    @Test
    void limparJsonMarkdown_mantemJsonPuro() {
        String json = "{\"preambulo\":\"ok\"}";
        assertThat(PeticaoAiService.limparJsonMarkdown(json)).isEqualTo(json);
    }

    @Test
    void removerTagsHtml_removeFormatacao() {
        assertThat(PeticaoAiService.removerTagsHtml("<strong>Danos morais</strong>"))
                .isEqualTo("Danos morais");
    }
}
