package br.com.vilareal.documento.parse;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoParseadoHeuristicsTest {

    @Test
    void extraiNumeroProcessoCnj() {
        String n = DocumentoParseadoHeuristics.extrairNumeroProcesso("Processo nº 5639293-32.2019.8.09.0006");
        assertThat(n).isEqualTo("5639293-32.2019.8.09.0006");
    }

    @Test
    void identificaTituloPrincipalRomano() {
        assertThat(DocumentoParseadoHeuristics.ehTituloPrincipal("I – DA SÍNTESE DA CONTROVÉRSIA", true, true))
                .isTrue();
    }

    @Test
    void identificaNomePeca() {
        assertThat(DocumentoParseadoHeuristics.ehNomePeca("RAZÕES FINAIS ESCRITAS", true, true))
                .isTrue();
    }

    @Test
    void reconheceEnderecamentoFemininoExcelentissima() {
        assertThat(DocumentoParseadoHeuristics.pareceEnderecamentoJuizo(
                        "EXCELENTÍSSIMA SENHORA DOUTORA JUÍZA DE DIREITO DA 3ª VARA CÍVEL DA COMARCA DE ANÁPOLIS – ESTADO DE GOIÁS"))
                .isTrue();
    }
}
