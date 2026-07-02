package br.com.vilareal.condominio.application;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CobrancaUnidadeFormatUtilTest {

    @Test
    void normalizarCodigoUnidade_converteVariacoesPlanilha() {
        assertThat(CobrancaUnidadeFormatUtil.normalizarCodigoUnidade("A0402")).isEqualTo("A-0402");
        assertThat(CobrancaUnidadeFormatUtil.normalizarCodigoUnidade("000-A")).isEqualTo("A-0000");
        assertThat(CobrancaUnidadeFormatUtil.normalizarCodigoUnidade("1201-R")).isEqualTo("R-1201");
        assertThat(CobrancaUnidadeFormatUtil.normalizarCodigoUnidade("1201 R")).isEqualTo("R-1201");
        assertThat(CobrancaUnidadeFormatUtil.normalizarCodigoUnidade("000A")).isEqualTo("A-0000");
        assertThat(CobrancaUnidadeFormatUtil.normalizarCodigoUnidade("a-103")).isEqualTo("A-0103");
        assertThat(CobrancaUnidadeFormatUtil.normalizarCodigoUnidade("ADM")).isEqualTo("ADM");
    }

    @Test
    void codigoParaUnidadeProcesso_converteLetraQuatroDigitos() {
        assertThat(CobrancaUnidadeFormatUtil.codigoParaUnidadeProcesso("A-0203")).isEqualTo("Unidade 203 A");
        assertThat(CobrancaUnidadeFormatUtil.codigoParaUnidadeProcesso("b-1201")).isEqualTo("Unidade 1201 B");
        assertThat(CobrancaUnidadeFormatUtil.codigoParaUnidadeProcesso("000-A")).isEqualTo("Unidade 0 A");
    }

    @Test
    void codigoParaUnidadeProcesso_mantemCodigosNaoPadrao() {
        assertThat(CobrancaUnidadeFormatUtil.codigoParaUnidadeProcesso("ADM")).isEqualTo("ADM");
    }

    @Test
    void chavesBuscaProcessoPorCodigo_incluiVariantes() {
        List<String> chaves = CobrancaUnidadeFormatUtil.chavesBuscaProcessoPorCodigo("A-0203");
        assertThat(chaves).contains("A-0203", "Unidade 203 A", "0203 A", "A0203", "0203-A");
    }

    @Test
    void chavesBuscaProcessoPorCodigo_incluiFormatoDigitosPrimeiro() {
        List<String> chaves = CobrancaUnidadeFormatUtil.chavesBuscaProcessoPorCodigo("000-A");
        assertThat(chaves)
                .contains("A-0000", "Unidade 0 A", "Unidade 000 A", "000-A", "000 A", "000A");
    }

    @Test
    void normalizarCodigoUnidade_converteCondoIdQuadraLote() {
        assertThat(CobrancaUnidadeFormatUtil.normalizarCodigoUnidade("QD12-LT03")).isEqualTo("QD12-LT03");
        assertThat(CobrancaUnidadeFormatUtil.normalizarCodigoUnidade("qd12lt03")).isEqualTo("QD12-LT03");
        assertThat(CobrancaUnidadeFormatUtil.normalizarCodigoUnidade("Unidade QD12LT03")).isEqualTo("QD12-LT03");
        assertThat(CobrancaUnidadeFormatUtil.normalizarCodigoUnidade("qd1-lt3")).isEqualTo("QD01-LT03");
    }

    @Test
    void chavesBuscaProcessoPorCodigo_incluiVariantesCondoId() {
        List<String> chaves = CobrancaUnidadeFormatUtil.chavesBuscaProcessoPorCodigo("QD12-LT03");
        assertThat(chaves).contains("QD12-LT03", "QD12LT03", "Unidade QD12-LT03", "Unidade QD12LT03");
    }
}
