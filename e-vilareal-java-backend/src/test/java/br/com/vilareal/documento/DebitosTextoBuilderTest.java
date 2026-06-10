package br.com.vilareal.documento;

import br.com.vilareal.documento.DebitosTextoBuilder.CapituloDebitos;
import br.com.vilareal.documento.DebitosTextoBuilder.DebitosParams;
import br.com.vilareal.documento.DebitosTextoBuilder.ModoDebito;
import br.com.vilareal.documento.DebitosTextoBuilder.TituloDebitoInput;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DebitosTextoBuilderTest {

    private static final String MODALIDADE_TAXA = "Taxa condominial vencida em ";
    private static final String DATA = "09/06/2026";

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    private static DebitosParams params(ModoDebito modo, String modalidade) {
        return new DebitosParams(modo, modalidade, DATA, "INPC", "2", "1", "mensal");
    }

    private static TituloDebitoInput titulo(
            String venc, int dias, String principal, String atual, String juros, String multa, String honor) {
        return new TituloDebitoInput(
                "Taxa Condominial", venc, dias, bd(principal), bd(atual), bd(juros), bd(multa), bd(honor));
    }

    @Test
    void itemCompletoComTodosEncargos() {
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(titulo("10/01/2024", 30, "1000.00", "50.00", "20.00", "20.00", "200.00")),
                params(ModoDebito.COMPLETO, MODALIDADE_TAXA));

        String html = cap.itensHtml().get(0);

        assertThat(html).startsWith("Taxa condominial vencida em 10/01/2024, com 30 (trinta) dias de atraso, ");
        assertThat(html).contains("O valor da atualização monetária para a data de hoje (09/06/2026), corresponde a");
        assertThat(html).contains("Pelos honorários");
        assertThat(html).contains("O valor da multa é");
        assertThat(html).contains("Os juros legais na proporção de 1% (um por cento) ao mês perfazem o total de");
        assertThat(html).contains("<u>no valor de R$ 1.000,00 (mil reais)</u>");
        assertThat(html).contains("<strong><u>Tudo perfaz o montante de R$ 1.290,00");
        assertThat(html).endsWith(", por este título;");
    }

    @Test
    void itemCompletoSemAtualizacao() {
        // INV2: atualização = 0 → nenhuma menção à atualização; demais encargos presentes.
        // INV3: sem a frase legada contraditória.
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(titulo("01/06/2026", 8, "300.00", "0.00", "5.00", "6.00", "30.00")),
                params(ModoDebito.COMPLETO, MODALIDADE_TAXA));

        String html = cap.itensHtml().get(0);
        assertThat(html).doesNotContain("atualização monetária");
        assertThat(html).doesNotContain("não corresponde a um valor expressivo");
        assertThat(html).doesNotContain("não se aplicam honorários");
        assertThat(html).contains("Pelos honorários");
        assertThat(html).contains("O valor da multa é");
        assertThat(html).contains("Os juros legais na proporção de 1% (um por cento) ao mês perfazem o total de");
    }

    @Test
    void itemCompletoSemHonorarios() {
        // INV2: honorários = 0 → nenhuma menção a honorários; demais presentes.
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(titulo("01/06/2026", 5, "300.00", "10.00", "5.00", "6.00", "0.00")),
                params(ModoDebito.COMPLETO, MODALIDADE_TAXA));

        String html = cap.itensHtml().get(0);
        assertThat(html).doesNotContain("honorários");
        assertThat(html).doesNotContain("não se aplicam honorários");
        assertThat(html).contains("O valor da atualização monetária para a data de hoje");
        assertThat(html).contains("O valor da multa é");
        assertThat(html).contains("Os juros legais na proporção");
    }

    @Test
    void itemCompletoSemMulta() {
        // INV2: multa = 0 → nenhuma menção a multa; demais presentes.
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(titulo("01/06/2026", 5, "300.00", "10.00", "5.00", "0.00", "30.00")),
                params(ModoDebito.COMPLETO, MODALIDADE_TAXA));

        String html = cap.itensHtml().get(0);
        assertThat(html).doesNotContain("O valor da multa");
        assertThat(html).contains("O valor da atualização monetária para a data de hoje");
        assertThat(html).contains("Pelos honorários");
        assertThat(html).contains("Os juros legais na proporção");
    }

    @Test
    void itemCompletoSemJuros() {
        // INV2: juros = 0 → nenhuma menção a juros (nem a frase "não somaram nenhum valor").
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(titulo("01/06/2026", 5, "300.00", "10.00", "0.00", "6.00", "30.00")),
                params(ModoDebito.COMPLETO, MODALIDADE_TAXA));

        String html = cap.itensHtml().get(0);
        assertThat(html).doesNotContain("Os juros legais");
        assertThat(html).doesNotContain("não somaram nenhum valor");
        assertThat(html).contains("O valor da atualização monetária para a data de hoje");
        assertThat(html).contains("Pelos honorários");
        assertThat(html).contains("O valor da multa é");
    }

    @Test
    void itemCompletoSemAtualizacaoEHonorarios() {
        // INV2: atualização e honorários = 0 → omite ambos; multa e juros permanecem.
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(titulo("01/06/2026", 8, "300.00", "0.00", "5.00", "6.00", "0.00")),
                params(ModoDebito.COMPLETO, MODALIDADE_TAXA));

        String html = cap.itensHtml().get(0);
        assertThat(html).doesNotContain("atualização monetária");
        assertThat(html).doesNotContain("honorários");
        assertThat(html).doesNotContain("não corresponde a um valor expressivo");
        assertThat(html).contains("O valor da multa é");
        assertThat(html).contains("Os juros legais na proporção");
    }

    @Test
    void fidelidadeUsaTotalInformadoEmVezDaSoma() {
        // Soma dos componentes = 1290,00, mas a tela exibiu 1290,01 (divergência de 1 centavo por
        // truncamento). INV1: o texto deve repetir o total da tela, não a soma recomposta.
        TituloDebitoInput t = new TituloDebitoInput(
                "Taxa Condominial", "10/01/2024", 30,
                bd("1000.00"), bd("50.00"), bd("20.00"), bd("20.00"), bd("200.00"),
                bd("1290.01"));
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(t), params(ModoDebito.COMPLETO, MODALIDADE_TAXA), bd("1290.01"));

        String html = cap.itensHtml().get(0);
        assertThat(html).contains("<strong><u>Tudo perfaz o montante de R$ 1.290,01");
        assertThat(html).doesNotContain("R$ 1.290,00");
        assertThat(cap.totalGeral()).isEqualByComparingTo("1290.01");
        assertThat(cap.totalGeralFormatado()).isEqualTo("R$ 1.290,01");
    }

    @Test
    void totalGeralInformadoPrevaleceSobreSoma() {
        // Soma dos itens = 1890,00; tela informou 1890,02. INV1: usa o total geral da tela.
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(
                        titulo("10/01/2024", 30, "1000.00", "50.00", "20.00", "20.00", "200.00"),
                        titulo("10/02/2024", 20, "500.00", "10.00", "5.00", "10.00", "75.00")),
                params(ModoDebito.COMPLETO, MODALIDADE_TAXA),
                bd("1890.02"));

        assertThat(cap.totalGeral()).isEqualByComparingTo("1890.02");
        assertThat(cap.totalGeralFormatado()).isEqualTo("R$ 1.890,02");
    }

    @Test
    void modoResumido() {
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(titulo("10/01/2024", 30, "1000.00", "50.00", "20.00", "20.00", "200.00")),
                params(ModoDebito.RESUMIDO, MODALIDADE_TAXA));

        String html = cap.itensHtml().get(0);
        assertThat(html).contains("<u>no valor principal de R$ 1.000,00 (mil reais)</u>");
        assertThat(html).contains("<strong><u>Com os encargos incidentes, tudo perfaz o montante de R$ 1.290,00");
        // Resumido não traz o detalhamento de encargos.
        assertThat(html).doesNotContain("Os juros legais na proporção");
    }

    @Test
    void totalGeralSomaItens() {
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(
                        titulo("10/01/2024", 30, "1000.00", "50.00", "20.00", "20.00", "200.00"), // total 1290,00
                        titulo("10/02/2024", 20, "500.00", "10.00", "5.00", "10.00", "75.00")),    // total  600,00
                params(ModoDebito.COMPLETO, MODALIDADE_TAXA));

        assertThat(cap.totalGeral()).isEqualByComparingTo("1890.00");
        assertThat(cap.totalGeralFormatado()).isEqualTo("R$ 1.890,00");
        assertThat(cap.totalGeralExtenso())
                .isEqualTo("mil oitocentos e noventa reais");
        assertThat(cap.itensHtml()).hasSize(2);
    }

    @Test
    void semSequenciaDePontosDuplicada() {
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(
                        titulo("01/06/2026", 8, "300.00", "0.00", "0.00", "0.00", "0.00"),
                        titulo("10/01/2024", 30, "1000.00", "50.00", "20.00", "20.00", "200.00")),
                params(ModoDebito.COMPLETO, MODALIDADE_TAXA));

        for (String html : cap.itensHtml()) {
            assertThat(html).doesNotContain(". . ");
        }
    }

    @Test
    void escapaHtmlNaDescricao() {
        TituloDebitoInput t = new TituloDebitoInput(
                "Cota A&B", "10/01/2024", 30, bd("100.00"), bd("0.00"), bd("0.00"), bd("0.00"), bd("0.00"));
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(t),
                params(ModoDebito.COMPLETO, "Diversos"));

        String html = cap.itensHtml().get(0);
        assertThat(html).contains("&amp;");
        assertThat(html).doesNotContain("A&B");
    }

    @Test
    void cabecalhoDinamicoInpcMensal() {
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(titulo("10/01/2024", 30, "1000.00", "50.00", "20.00", "20.00", "200.00")),
                new DebitosParams(ModoDebito.COMPLETO, MODALIDADE_TAXA, DATA, "INPC", "2 %", "1 %", "mensal"));

        String cab = cap.cabecalhoHtml();
        assertThat(cab).contains("índice INPC");
        assertThat(cab).contains("multa legal de 2%");
        assertThat(cab).contains("juros de 1% ao mês");
        assertThat(cab).contains("<u>http://www.tjdft.jus.br/servicos/atualizacao-monetaria-1/calculo</u>");
    }

    @Test
    void cabecalhoDinamicoIpcaeDiariaComDecimal() {
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(titulo("10/01/2024", 30, "1000.00", "50.00", "20.00", "20.00", "200.00")),
                new DebitosParams(ModoDebito.COMPLETO, MODALIDADE_TAXA, DATA, "IPCA-E", "2", "1,5", "diaria"));

        String cab = cap.cabecalhoHtml();
        assertThat(cab).contains("índice IPCA-E");
        assertThat(cab).contains("multa legal de 2%");
        assertThat(cab).contains("juros de 1,5% ao dia");
    }

    @Test
    void cabecalhoPeriodicidadeVaziaUsaMesPorDefault() {
        CapituloDebitos cap = DebitosTextoBuilder.montar(
                List.of(titulo("10/01/2024", 30, "1000.00", "50.00", "20.00", "20.00", "200.00")),
                new DebitosParams(ModoDebito.COMPLETO, MODALIDADE_TAXA, DATA, "INPC", "2", "1", ""));

        assertThat(cap.cabecalhoHtml()).contains("ao mês");
    }
}
