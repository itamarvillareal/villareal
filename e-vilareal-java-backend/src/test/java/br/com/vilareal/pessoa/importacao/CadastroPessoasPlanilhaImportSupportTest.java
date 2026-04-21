package br.com.vilareal.pessoa.importacao;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CadastroPessoasPlanilhaImportSupportTest {

    @Test
    void analisarCpfCnpj_ausente_invalido_valido() {
        assertThat(CadastroPessoasPlanilhaImportSupport.analisarCpfCnpj(null).resultado())
                .isEqualTo(CadastroPessoasPlanilhaImportSupport.CpfCnpjResultado.AUSENTE);
        assertThat(CadastroPessoasPlanilhaImportSupport.analisarCpfCnpj("").resultado())
                .isEqualTo(CadastroPessoasPlanilhaImportSupport.CpfCnpjResultado.AUSENTE);
        assertThat(CadastroPessoasPlanilhaImportSupport.analisarCpfCnpj("   ").resultado())
                .isEqualTo(CadastroPessoasPlanilhaImportSupport.CpfCnpjResultado.AUSENTE);

        assertThat(CadastroPessoasPlanilhaImportSupport.analisarCpfCnpj("1234567890").resultado())
                .isEqualTo(CadastroPessoasPlanilhaImportSupport.CpfCnpjResultado.INVALIDO);
        assertThat(CadastroPessoasPlanilhaImportSupport.analisarCpfCnpj("123456789012345").resultado())
                .isEqualTo(CadastroPessoasPlanilhaImportSupport.CpfCnpjResultado.INVALIDO);

        CadastroPessoasPlanilhaImportSupport.CpfCnpjNormalizado v11 =
                CadastroPessoasPlanilhaImportSupport.analisarCpfCnpj("123.456.789-09");
        assertThat(v11.resultado()).isEqualTo(CadastroPessoasPlanilhaImportSupport.CpfCnpjResultado.VALIDO);
        assertThat(v11.valor()).isEqualTo("12345678909");

        CadastroPessoasPlanilhaImportSupport.CpfCnpjNormalizado v14 =
                CadastroPessoasPlanilhaImportSupport.analisarCpfCnpj("09.319.421/0001-54");
        assertThat(v14.resultado()).isEqualTo(CadastroPessoasPlanilhaImportSupport.CpfCnpjResultado.VALIDO);
        assertThat(v14.valor()).isEqualTo("09319421000154");
    }

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

    @Test
    void normalizeNomeCadastro_maiusculas() {
        assertThat(CadastroPessoasPlanilhaImportSupport.normalizeNomeCadastro("  João da Silva  "))
                .isEqualTo("JOÃO DA SILVA");
    }

    @Test
    void resolveCpfCnpjDigitosPlanilha_brutoOuNormalizado() {
        assertThat(CadastroPessoasPlanilhaImportSupport.resolveCpfCnpjDigitosPlanilha("123.456.789-09", ""))
                .isEqualTo("12345678909");
        assertThat(CadastroPessoasPlanilhaImportSupport.resolveCpfCnpjDigitosPlanilha("", "09319421000154"))
                .isEqualTo("09319421000154");
        assertThat(CadastroPessoasPlanilhaImportSupport.resolveCpfCnpjDigitosPlanilha("inválido", "12345678909"))
                .isEqualTo("12345678909");
        assertThat(CadastroPessoasPlanilhaImportSupport.resolveCpfCnpjDigitosPlanilha("", "")).isEmpty();
    }
}
