package br.com.vilareal.documento;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class HomologacaoAcordoTextoBuilderTest {

    @Test
    void montarListaTitulos_formataVencimentosEValores() {
        String html = HomologacaoAcordoTextoBuilder.montarListaTitulos(List.of(
                new HomologacaoAcordoTextoBuilder.TituloLinha("05/12/2025", new BigDecimal("3298.56")),
                new HomologacaoAcordoTextoBuilder.TituloLinha("10/03/2026", new BigDecimal("254.91"))));

        assertThat(html).contains("05/12/2025 no valor de R$ 3.298,56");
        assertThat(html).contains("; 10/03/2026 no valor de R$ 254,91");
    }

    @Test
    void montarListaBoletos_usaOrdinalEExtenso() {
        String html = HomologacaoAcordoTextoBuilder.montarListaBoletos(List.of(
                new HomologacaoAcordoTextoBuilder.BoletoLinha(new BigDecimal("1864.28"), "05/08/2026"),
                new HomologacaoAcordoTextoBuilder.BoletoLinha(new BigDecimal("1864.28"), "05/09/2026")));

        assertThat(html).contains("1º boleto no valor de R$ 1.864,28");
        assertThat(html).contains("mil oitocentos e sessenta e quatro reais");
        assertThat(html).contains("2º boleto");
        assertThat(html).contains("vencimento em 05/09/2026");
    }

    @Test
    void montarCorpoAcordo_incluiClausulasPadrao() {
        var clausulas = new HomologacaoAcordoTextoBuilder.ClausulasConfig(
                new BigDecimal("30"),
                new BigDecimal("1"),
                new BigDecimal("20"),
                "liquidadas por intermédio do pagamento dos boletos bancários anexos",
                true,
                true,
                true,
                true,
                true);

        String html = HomologacaoAcordoTextoBuilder.montarCorpoAcordo(
                List.of(new HomologacaoAcordoTextoBuilder.BoletoLinha(new BigDecimal("1000.00"), "01/08/2026")),
                clausulas);

        assertThat(html).contains("DO ACORDO");
        assertThat(html).contains("01 (uma) parcela");
        assertThat(html).contains("30% (trinta por cento)");
        assertThat(html).contains("1.335, inciso III");
        assertThat(html).contains("02 (duas) vias de igual teor");
        assertThat(html).contains("artigo 487, III, 'b' do CPC");
    }

    @Test
    void montarCorpoPedidos_listaPedidosComAlíneas() {
        var clausulas = new HomologacaoAcordoTextoBuilder.ClausulasConfig(
                new BigDecimal("30"),
                new BigDecimal("1"),
                new BigDecimal("20"),
                "",
                false,
                false,
                false,
                true,
                true);

        String html = HomologacaoAcordoTextoBuilder.montarCorpoPedidos(clausulas);

        assertThat(html).contains("DOS PEDIDOS");
        assertThat(html).contains("class=\"pedido\"");
        assertThat(html).contains("artigo 90 do Código de Processo Civil");
        assertThat(html).contains("artigo 922 do Código de Processo Civil");
    }

    @Test
    void montarQualificacaoInterlocutoria_usaNomesDasPartes() {
        String html = PeticaoHomologacaoAcordoService.montarQualificacaoInterlocutoriaHtml(List.of(), List.of());
        assertThat(html).contains("qualificacao-interlocutoria");
    }
}
