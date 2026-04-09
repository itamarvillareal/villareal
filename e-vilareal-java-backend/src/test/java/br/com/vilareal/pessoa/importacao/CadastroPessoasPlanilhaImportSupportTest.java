package br.com.vilareal.pessoa.importacao;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CadastroPessoasPlanilhaImportSupportTest {

    @Test
    void normalizeCpfCnpj_aceita11e14() {
        assertThat(CadastroPessoasPlanilhaImportSupport.normalizeCpfCnpj("123.456.789-09"))
                .contains("12345678909");
        assertThat(CadastroPessoasPlanilhaImportSupport.normalizeCpfCnpj("09.319.421/0001-54"))
                .contains("09319421000154");
        assertThat(CadastroPessoasPlanilhaImportSupport.normalizeCpfCnpj("")).isEmpty();
        assertThat(CadastroPessoasPlanilhaImportSupport.normalizeCpfCnpj("123")).isEmpty();
    }

    @Test
    void normalizeUf_df() {
        assertThat(CadastroPessoasPlanilhaImportSupport.normalizeUf("DF")).isEqualTo("DF");
        assertThat(CadastroPessoasPlanilhaImportSupport.normalizeUf(" go ")).isEqualTo("GO");
    }

    @Test
    void normalizeEmail_removeSemicolon() {
        assertThat(CadastroPessoasPlanilhaImportSupport.normalizeEmailForStorage("  a@b.com;; "))
                .isEqualTo("a@b.com");
    }

    @Test
    void mergeTelefoneValor_trunca500() {
        String longInf = "x".repeat(600);
        String out = CadastroPessoasPlanilhaImportSupport.mergeTelefoneValor("61999999999", longInf);
        assertThat(out).hasSize(500);
    }

    @Test
    void truncate() {
        assertThat(CadastroPessoasPlanilhaImportSupport.truncate("abcdef", 3)).isEqualTo("abc");
    }
}
