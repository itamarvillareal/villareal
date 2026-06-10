package br.com.vilareal.documento;

import br.com.vilareal.documento.FlexaoUtil.Genero;
import br.com.vilareal.documento.FlexaoUtil.Numero;
import br.com.vilareal.documento.MontadorCorpoPeca.BlocoTopico;
import br.com.vilareal.documento.TopicoTokenResolver.ProcessamentoContexto;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MontadorCorpoPecaTest {

    private static ProcessamentoContexto ctx() {
        return new ProcessamentoContexto(
                Genero.MASCULINO, Numero.SINGULAR,
                Genero.MASCULINO, Numero.SINGULAR,
                Numero.PLURAL,
                "Apto 101 Bloco A",
                "R$ 1.234,56",
                "mil duzentos e trinta e quatro reais e cinquenta e seis centavos",
                "qualificação do autor",
                "qualificação do réu",
                "FULANO DE TAL",
                "BELTRANO DE TAL",
                Map.of());
    }

    @Test
    void titulo() {
        String r = MontadorCorpoPeca.processarBlocos(List.of(new BlocoTopico("titulo", "DOS FATOS:")), ctx());
        assertThat(r).isEqualTo("<p class=\"titulo\">DOS FATOS:</p>");
    }

    @Test
    void paragrafoComFlex() {
        String r = MontadorCorpoPeca.processarBlocos(
                List.of(new BlocoTopico(
                        "paragrafo",
                        "{{flex:reu:o|proper}} {{flex:reu:executado|proper}} {{flex:reu:está|lower}} inadimplente")),
                ctx());
        assertThat(r).isEqualTo("<p class=\"paragrafo\">O Executado está inadimplente</p>");
    }

    @Test
    void recuado() {
        String r = MontadorCorpoPeca.processarBlocos(
                List.of(new BlocoTopico("recuado", "Art. 1.336. São deveres do condômino…")), ctx());
        assertThat(r).isEqualTo("<p class=\"recuado\">Art. 1.336. São deveres do condômino…</p>");
    }

    @Test
    void pedidoComFlex() {
        String r = MontadorCorpoPeca.processarBlocos(
                List.of(new BlocoTopico(
                        "pedido",
                        "Seja {{flex:reu:CONDENADO|lower}} {{flex:reu:o|lower}} {{flex:reu:executado|proper}} ao pagamento")),
                ctx());
        assertThat(r).isEqualTo("<p class=\"pedido\">Seja condenado o Executado ao pagamento</p>");
    }

    @Test
    void blocoQueResolveVazioEhDescartado() {
        String r = MontadorCorpoPeca.processarBlocos(
                List.of(new BlocoTopico("paragrafo", "{{pergunta:ARTIGO DO REGIMENTO INTERNO}}")), ctx());
        assertThat(r).isEmpty();
    }

    @Test
    void classeNulaUsaParagrafo() {
        String r = MontadorCorpoPeca.processarBlocos(
                List.of(new BlocoTopico(null, "texto qualquer")), ctx());
        assertThat(r).isEqualTo("<p class=\"paragrafo\">texto qualquer</p>");
    }

    @Test
    void extrairBlocosPorClasse() {
        List<BlocoTopico> blocos = List.of(
                new BlocoTopico("paragrafo", "Texto."),
                new BlocoTopico("pedido", "Pedido A."),
                new BlocoTopico("pedido", "Pedido B."));
        assertThat(MontadorCorpoPeca.extrairBlocosPorClasse(blocos, "pedido")).hasSize(2);
        assertThat(MontadorCorpoPeca.processarBlocosExcluindo(blocos, ctx(), "pedido"))
                .isEqualTo("<p class=\"paragrafo\">Texto.</p>");
    }

    @Test
    void ordemESemSeparadores() {
        List<BlocoTopico> blocos = new ArrayList<>(Arrays.asList(
                new BlocoTopico("titulo", "DOS FATOS:"),
                new BlocoTopico("paragrafo", "Primeiro parágrafo."),
                new BlocoTopico("paragrafo", "{{pergunta:INEXISTENTE}}"),
                new BlocoTopico("recuado", "Citação."),
                new BlocoTopico("pedido", "Pedido final.")));
        String r = MontadorCorpoPeca.processarBlocos(blocos, ctx());
        assertThat(r).isEqualTo(
                "<p class=\"titulo\">DOS FATOS:</p>"
                        + "<p class=\"paragrafo\">Primeiro parágrafo.</p>"
                        + "<p class=\"recuado\">Citação.</p>"
                        + "<p class=\"pedido\">Pedido final.</p>");
    }
}
