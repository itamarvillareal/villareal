package br.com.vilareal.documento.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoRodapeHtmlConverterTest {

    private static final String RODAPE =
            """
            Av. Pinheiro Chagas, nº 232, Bairro Jundiaí, Anápolis-GO, CEP n 75.110-580.
            Telefones: 62-3321-2374 (fixo), 62-98129-6212 (tim)
            E-mail: villareal@villarealadvocacia.adv.br
            www.villarealadvocacia.adv.br
            """;

    @Test
    void primeiraPagina_incluiTodasAsLinhas() {
        String html = DocumentoRodapeHtmlConverter.primeiraPagina(RODAPE);

        assertThat(html).contains("rodape-linha1").contains("Pinheiro Chagas");
        assertThat(html).contains("rodape-linha2").contains("Telefones");
        assertThat(html).contains("rodape-linha3").contains("E-mail").contains("rodape-email");
        assertThat(html).contains("rodape-linha4").contains("www.villarealadvocacia");
    }

    @Test
    void paginasSeguintes_omiteLinhaDeTelefone() {
        String html = DocumentoRodapeHtmlConverter.paginasSeguintes(RODAPE);

        assertThat(html).contains("rodape-linha1").contains("Pinheiro Chagas");
        assertThat(html).doesNotContain("Telefones");
        assertThat(html).contains("rodape-linha2").contains("E-mail");
        assertThat(html).contains("rodape-linha3").contains("www.villarealadvocacia");
    }
}
