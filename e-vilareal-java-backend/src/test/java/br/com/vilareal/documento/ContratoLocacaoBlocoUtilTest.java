package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContratoLocacaoBlocoUtilTest {

    @Test
    void extrairTituloCentral_removeTagsLegadas() {
        String titulo = ContratoLocacaoBlocoUtil.extrairTituloCentral(
                "(\"CENTRAL\")()()()()()CONTRATO DE LOCAÇÃO");
        assertThat(titulo).isEqualTo("CONTRATO DE LOCAÇÃO");
    }

    @Test
    void limparMetadadosFormato_removeBlocoComoLocadorAntesDoPreambulo() {
        String texto =
                "(\"como LOCADOR ITAMAR A, \",\"como LOCADOR, ITAMAR A \",\"como LOCATÁRIA ADELAIDE, \",\"como LOCATÁRIA, ADELAIDE \")"
                        + "Pelo presente instrumento particular, como LOCADOR, ITAMAR A, têm por justo e contratado o seguinte:";

        String out = ContratoLocacaoBlocoUtil.limparMetadadosFormato(texto);

        assertThat(out).doesNotContain("(\"como LOCADOR");
        assertThat(out).startsWith("Pelo presente instrumento");
    }

    @Test
    void detectaParagrafoClausulaPelaTagDoTemplate() {
        assertThat(ContratoLocacaoBlocoUtil.isParagrafoClausula("(\"PARAG CLAUSULA\")()()§1º Texto", null))
                .isTrue();
        assertThat(ContratoLocacaoBlocoUtil.isClausulaPrincipal("(\"CLAUSULA\")()()O Locador dá", null))
                .isTrue();
    }

    @Test
    void prefixoClausulaHtml_incluiNumeroOrdinal() {
        assertThat(ContratoLocacaoBlocoUtil.prefixoClausulaHtml(3)).isEqualTo("<strong>Cláusula 3ª.</strong> ");
    }
}
