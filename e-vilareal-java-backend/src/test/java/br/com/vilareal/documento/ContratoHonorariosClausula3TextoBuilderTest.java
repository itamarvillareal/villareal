package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static br.com.vilareal.documento.FlexaoUtil.Genero.FEMININO;
import static br.com.vilareal.documento.FlexaoUtil.Genero.MASCULINO;
import static br.com.vilareal.documento.FlexaoUtil.Numero.PLURAL;
import static br.com.vilareal.documento.FlexaoUtil.Numero.SINGULAR;
import static org.assertj.core.api.Assertions.assertThat;

class ContratoHonorariosClausula3TextoBuilderTest {

    private static ContratoHonorariosClausula3Dados dadosValorFixoSimples() {
        return new ContratoHonorariosClausula3Dados(
                ContratoHonorariosClausula3TextoBuilder.TIPO_VALOR_FIXO,
                null,
                new BigDecimal("1000.00"),
                false,
                false,
                null,
                null,
                null,
                null,
                ContratoHonorariosClausula3TextoBuilder.FORMA_PAGAMENTO_PIX,
                null);
    }

    @Test
    void flexaoContratanteMasculinoSingular() {
        var flexao = new ContratoContratanteFlexao(MASCULINO, SINGULAR);
        String texto = ContratoHonorariosClausula3TextoBuilder.montarTexto(dadosValorFixoSimples(), flexao);
        assertThat(texto).contains("receberá do Contratante os honorários");
    }

    @Test
    void flexaoContratanteFemininoSingular() {
        var flexao = new ContratoContratanteFlexao(FEMININO, SINGULAR);
        String texto = ContratoHonorariosClausula3TextoBuilder.montarTexto(dadosValorFixoSimples(), flexao);
        assertThat(texto).contains("receberá da Contratante os honorários");
    }

    @Test
    void flexaoContratantesMasculinoPlural() {
        var flexao = new ContratoContratanteFlexao(MASCULINO, PLURAL);
        String texto = ContratoHonorariosClausula3TextoBuilder.montarTexto(dadosValorFixoSimples(), flexao);
        assertThat(texto).contains("receberá dos Contratantes os honorários");
    }

    @Test
    void flexaoContratantesFemininoPlural() {
        var flexao = new ContratoContratanteFlexao(FEMININO, PLURAL);
        String texto = ContratoHonorariosClausula3TextoBuilder.montarTexto(dadosValorFixoSimples(), flexao);
        assertThat(texto).contains("receberá das Contratantes os honorários");
    }

    @Test
    void montaPercentualPadrao35() {
        var dados = new ContratoHonorariosClausula3Dados(
                ContratoHonorariosClausula3TextoBuilder.TIPO_PERCENTUAL_PROVEITO,
                new BigDecimal("35"),
                null,
                false,
                false,
                null,
                null,
                null,
                null,
                null,
                null);

        String texto = ContratoHonorariosClausula3TextoBuilder.montarTexto(dados);

        assertThat(texto).contains("35%");
        assertThat(texto).contains("trinta e cinco por cento");
        assertThat(texto).contains("proveito econômico");
    }

    @Test
    void montaValorFixoComParcelamento() {
        var dados = new ContratoHonorariosClausula3Dados(
                ContratoHonorariosClausula3TextoBuilder.TIPO_VALOR_FIXO,
                null,
                new BigDecimal("5000.00"),
                true,
                true,
                5,
                new BigDecimal("5000.00"),
                LocalDate.of(2026, 7, 10),
                "MENSAL",
                "PIX",
                null);

        String texto = ContratoHonorariosClausula3TextoBuilder.montarTexto(dados);

        assertThat(texto).contains("R$");
        assertThat(texto).contains("cinco mil reais");
        assertThat(texto).contains("5 parcelas mensais");
        assertThat(texto).contains("10/07/2026");

        var parcelas = ContratoHonorariosClausula3TextoBuilder.calcularParcelas(dados);
        assertThat(parcelas).hasSize(5);
        assertThat(parcelas.get(0).valor()).isEqualByComparingTo("1000.00");
        assertThat(parcelas.get(4).valor()).isEqualByComparingTo("1000.00");
    }

    @Test
    void montaValorFixoComPix() {
        var dados = new ContratoHonorariosClausula3Dados(
                ContratoHonorariosClausula3TextoBuilder.TIPO_VALOR_FIXO,
                null,
                new BigDecimal("1000.00"),
                false,
                false,
                null,
                null,
                null,
                null,
                ContratoHonorariosClausula3TextoBuilder.FORMA_PAGAMENTO_PIX,
                null);

        String texto = ContratoHonorariosClausula3TextoBuilder.montarTexto(dados);

        assertThat(texto).contains("via PIX, chave CNPJ 39.720.563/0001-90");
    }

    @Test
    void montaValorFixoComPixEDataPagamento() {
        var dados = new ContratoHonorariosClausula3Dados(
                ContratoHonorariosClausula3TextoBuilder.TIPO_VALOR_FIXO,
                null,
                new BigDecimal("1000.00"),
                false,
                false,
                null,
                null,
                LocalDate.of(2026, 6, 20),
                null,
                ContratoHonorariosClausula3TextoBuilder.FORMA_PAGAMENTO_PIX,
                null);

        String texto = ContratoHonorariosClausula3TextoBuilder.montarTexto(dados);

        assertThat(texto).contains("via PIX, chave CNPJ 39.720.563/0001-90, com vencimento em 20/06/2026");
    }

    @Test
    void montaValorFixoComBoleto() {
        var dados = new ContratoHonorariosClausula3Dados(
                ContratoHonorariosClausula3TextoBuilder.TIPO_VALOR_FIXO,
                null,
                new BigDecimal("1000.00"),
                false,
                false,
                null,
                null,
                null,
                null,
                ContratoHonorariosClausula3TextoBuilder.FORMA_PAGAMENTO_BOLETO,
                null);

        String texto = ContratoHonorariosClausula3TextoBuilder.montarTexto(dados);

        assertThat(texto).contains("boleto bancário");
    }

    @Test
    void montaMistoComParcelamentoSemFinanceiro() {
        var dados = new ContratoHonorariosClausula3Dados(
                ContratoHonorariosClausula3TextoBuilder.TIPO_MISTO,
                new BigDecimal("35"),
                new BigDecimal("1000.00"),
                true,
                false,
                2,
                new BigDecimal("1000.00"),
                LocalDate.of(2026, 7, 10),
                "MENSAL",
                "PIX",
                null);

        String texto = ContratoHonorariosClausula3TextoBuilder.montarTexto(dados);

        assertThat(texto).contains("valor fixo de R$");
        assertThat(texto).contains("2 parcelas mensais");
        assertThat(ContratoHonorariosClausula3TextoBuilder.calcularParcelas(dados)).hasSize(2);
    }
}
