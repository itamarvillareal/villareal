package br.com.vilareal.documento.parse;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoReformatarPdfParserTest {

    private final DocumentoReformatarPdfParser parser = new DocumentoReformatarPdfParser();

    @Test
    void parsearTexto_classificaEstruturaBasica() {
        String texto =
                """
                MERITÍSSIMO JUÍZO DO 3º JUIZADO ESPECIAL CÍVEL DA COMARCA DE ANÁPOLIS - GO

                Processo nº 5639293-32.2019.8.09.0006

                YASMINE CECILIO, brasileira, vem apresentar RAZÕES FINAIS.

                RAZÕES FINAIS ESCRITAS

                I – DA SÍNTESE DA CONTROVÉRSIA

                Texto da síntese com fatos relevantes.

                II – DO DIREITO

                Fundamentação jurídica aplicável.

                Nestes termos,
                pede deferimento.

                Anápolis, estado de Goiás, 25 de maio de 2026.
                """;

        DocumentoParseado r = parser.parsearTexto(texto);

        assertThat(r.enderecoJuizo()).contains("MERITÍSSIMO");
        assertThat(r.numeroProcesso()).isEqualTo("5639293-32.2019.8.09.0006");
        assertThat(r.nomePeca()).isEqualTo("RAZÕES FINAIS ESCRITAS");
        assertThat(r.secoes()).hasSizeGreaterThanOrEqualTo(2);
        assertThat(r.secoes().get(0).titulo()).contains("SÍNTESE");
        assertThat(r.fecho()).isNotEmpty();
        assertThat(r.localData()).contains("2026");
    }
}
