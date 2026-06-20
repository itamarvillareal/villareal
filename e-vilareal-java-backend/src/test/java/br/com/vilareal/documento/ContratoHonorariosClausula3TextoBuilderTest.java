package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class ContratoHonorariosClausula3TextoBuilderTest {

    @Test
    void montaPercentualPadrao35() {
        var dados = new ContratoHonorariosClausula3Dados(
                ContratoHonorariosClausula3TextoBuilder.TIPO_PERCENTUAL_PROVEITO,
                new BigDecimal("35"),
                null,
                false,
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
                5,
                new BigDecimal("5000.00"),
                LocalDate.of(2026, 7, 10),
                "MENSAL",
                "PIX");

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
}
