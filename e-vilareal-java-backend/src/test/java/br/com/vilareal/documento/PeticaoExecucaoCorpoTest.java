package br.com.vilareal.documento;

import br.com.vilareal.documento.DebitosTextoBuilder.CapituloDebitos;
import br.com.vilareal.documento.FlexaoUtil.Genero;
import br.com.vilareal.documento.FlexaoUtil.Numero;
import br.com.vilareal.documento.MontadorCorpoPeca.BlocoTopico;
import br.com.vilareal.documento.TopicoTokenResolver.ProcessamentoContexto;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PeticaoExecucaoCorpoTest {

    private static ProcessamentoContexto ctx() {
        return new ProcessamentoContexto(
                Genero.MASCULINO, Numero.SINGULAR,
                Genero.MASCULINO, Numero.SINGULAR,
                Numero.PLURAL,
                "Apto 101",
                "R$ 100,00",
                "cem reais",
                "qualificação autor",
                "qualificação réu",
                "AUTOR",
                "RÉU",
                Map.of());
    }

    @Test
    void separaPedidosDoCapituloDireitoComTituloProprio() {
        List<BlocoTopico> direito = List.of(
                new BlocoTopico("titulo", "DO DIREITO:"),
                new BlocoTopico("paragrafo", "Fundamentação jurídica."),
                new BlocoTopico("titulo", "DOS PEDIDOS:"),
                new BlocoTopico("pedido", "Primeiro pedido."),
                new BlocoTopico("pedido", "Segundo pedido."));

        List<BlocoTopico> pedidos = MontadorCorpoPeca.extrairBlocosPorClasse(direito, "pedido");
        String corpoDireito = MontadorCorpoPeca.processarBlocos(
                direito.stream()
                        .filter(b -> !"pedido".equals(b.classe()))
                        .filter(b -> !PeticaoExecucaoService.ehTituloDosPedidos(b))
                        .toList(),
                ctx());
        String capituloPedidos = "<p class=\"titulo\">DOS PEDIDOS</p>"
                + "<p class=\"paragrafo\">Diante do exposto, requer de Vossa Excelência:</p>"
                + MontadorCorpoPeca.processarBlocos(pedidos, ctx());

        assertThat(pedidos).hasSize(2);
        assertThat(corpoDireito).isEqualTo(
                "<p class=\"titulo\">DO DIREITO:</p>"
                        + "<p class=\"paragrafo\">Fundamentação jurídica.</p>");
        assertThat(capituloPedidos).isEqualTo(
                "<p class=\"titulo\">DOS PEDIDOS</p>"
                        + "<p class=\"paragrafo\">Diante do exposto, requer de Vossa Excelência:</p>"
                        + "<p class=\"pedido\">Primeiro pedido.</p>"
                        + "<p class=\"pedido\">Segundo pedido.</p>");
    }

    @Test
    void qualificacaoCabecalhoIsolaNaturezaAcaoCentralizada() {
        String html = PeticaoExecucaoService.montarQualificacaoCabecalhoHtml(
                "<strong>AUTOR</strong>, qualificação.",
                "<strong>RÉU</strong>, qualificação.",
                "Ação de Execução de Taxa Condominial");

        assertThat(html).startsWith("<p class=\"qualificacao-parte\">");
        assertThat(html).contains(
                "</p><p class=\"natureza-acao\"><strong><u>AÇÃO DE EXECUÇÃO DE TAXA CONDOMINIAL</u></strong></p>");
        assertThat(html).endsWith(
                "<p class=\"qualificacao-parte\">em face de <strong>RÉU</strong>, qualificação., consubstanciado"
                        + " nas razões de fato e de direito que prontamente passa a expor.</p>");
    }

    @Test
    void formataCidadeLocalDataSemUf() {
        assertThat(PeticaoExecucaoService.formatarCidadeLocalData("ANÁPOLIS")).isEqualTo("Anápolis");
        assertThat(PeticaoExecucaoService.formatarCidadeLocalData(null)).isEqualTo("Anápolis");
    }

    @Test
    void capituloValorCausaAposPedidosComDebitoExequendo() {
        CapituloDebitos cap = new CapituloDebitos(
                "",
                List.of(),
                new BigDecimal("5912.88"),
                "R$ 5.912,88",
                "cinco mil novecentos e doze reais e oitenta e oito centavos");

        assertThat(PeticaoExecucaoService.formatarExtensoValorCausa(cap.totalGeralExtenso()))
                .isEqualTo("cinco mil, novecentos e doze reais e oitenta e oito centavos");
        assertThat(PeticaoExecucaoService.montarCapituloValorCausa(cap)).isEqualTo(
                "<p class=\"titulo\">DO VALOR DA CAUSA:</p>"
                        + "<p class=\"paragrafo\">Dá-se ao presente pleito, o valor defeso e cabível de "
                        + "<span class=\"valor-monetario\"><strong><span class=\"valor-monetario-num\">R$ 5.912,88</span> (cinco mil, novecentos e doze reais"
                        + " e oitenta e oito centavos).</strong></span></p>");
    }

    @Test
    void normalizaNaturezaAcaoSemTil() {
        assertThat(PeticaoExecucaoService.normalizarNaturezaAcao("AÇAO DE EXECUÇÃO DE TAXA CONDOMINIAL"))
                .isEqualTo("AÇÃO DE EXECUÇÃO DE TAXA CONDOMINIAL");
    }

    @Test
    void identificaTituloDosPedidos() {
        assertThat(PeticaoExecucaoService.ehTituloDosPedidos(new BlocoTopico("titulo", "DOS PEDIDOS:")))
                .isTrue();
        assertThat(PeticaoExecucaoService.ehTituloDosPedidos(new BlocoTopico("titulo", "DO DIREITO:")))
                .isFalse();
        assertThat(PeticaoExecucaoService.ehTituloDosPedidos(new BlocoTopico("pedido", "Pedido isolado.")))
                .isFalse();
    }
}
