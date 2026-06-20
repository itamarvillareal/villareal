package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContratoHonorariosClausulasTest {

    @Test
    void montarClausulas_usaObjetoInformadoNaClausula2() {
        var clausulas = ContratoHonorariosClausulas.montarClausulas(
                "EM AÇÃO DE COBRANÇA, em face de FULANO DE TAL", null);

        assertThat(clausulas).hasSize(16);
        assertThat(clausulas.get(0)).startsWith("Cláusula 1ª.");
        assertThat(clausulas.get(1)).contains("EM AÇÃO DE COBRANÇA, em face de FULANO DE TAL");
        assertThat(clausulas.get(15)).startsWith("Cláusula 16ª.");
    }

    @Test
    void montarClausulas_usaRemuneracaoInformadaNaClausula3() {
        var clausulas = ContratoHonorariosClausulas.montarClausulas(
                null,
                "Em REMUNERAÇÃO desses serviços, honorários fixos de R$ 5.000,00 (cinco mil reais);");

        assertThat(clausulas.get(2)).isEqualTo(
                "Cláusula 3ª. Em REMUNERAÇÃO desses serviços, honorários fixos de R$ 5.000,00 (cinco mil reais);");
    }

    @Test
    void montarFecho_contemDuasViasETestemunhas() {
        assertThat(ContratoHonorariosClausulas.montarFecho())
                .contains("duas (02) vias")
                .contains("testemunhas");
    }

    @Test
    void montarQualificacaoContratoContratado_montaTextoDoAdvogado() {
        String qualificacao = QualificacaoPessoaUtil.montarQualificacaoContratoContratado(
                "Dr. Itamar Alexandre Felix Villa Real Junior", "OAB/GO 33.329");

        assertThat(qualificacao).startsWith("o advogado Dr. ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR");
        assertThat(qualificacao).contains("OAB/GO sob o nº 33.329");
        assertThat(qualificacao).contains("Avenida Pinheiro Chagas");
    }
}
