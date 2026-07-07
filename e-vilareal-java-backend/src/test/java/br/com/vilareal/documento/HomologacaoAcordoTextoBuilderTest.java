package br.com.vilareal.documento;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class HomologacaoAcordoTextoBuilderTest {

    @Test
    void montarListaTitulos_formataVencimentosEValores() {
        String html = HomologacaoAcordoTextoBuilder.montarListaTitulos(List.of(
                new HomologacaoAcordoTextoBuilder.TituloLinha("05/12/2025", new BigDecimal("3298.56")),
                new HomologacaoAcordoTextoBuilder.TituloLinha("10/03/2026", new BigDecimal("254.91"))));

        assertThat(html).contains("<span class=\"data-unica\">05/12/2025</span> no valor de R$ 3.298,56");
        assertThat(html).contains("; <span class=\"data-unica\">10/03/2026</span> no valor de R$ 254,91");
    }

    @Test
    void montarListaBoletos_usaOrdinalEExtenso() {
        String html = HomologacaoAcordoTextoBuilder.montarListaBoletos(List.of(
                new HomologacaoAcordoTextoBuilder.BoletoLinha(new BigDecimal("1864.28"), "05/08/2026"),
                new HomologacaoAcordoTextoBuilder.BoletoLinha(new BigDecimal("1864.28"), "05/09/2026")));

        assertThat(html).contains("1º boleto no valor de R$ 1.864,28");
        assertThat(html).contains("mil oitocentos e sessenta e quatro reais");
        assertThat(html).contains("2º boleto");
        assertThat(html).contains("vencimento em <span class=\"data-unica\">05/09/2026</span>");
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
        assertThat(html).contains("Diante do exposto, requer de Vossa Excelência:");
        assertThat(html).contains("class=\"pedido\"");
        assertThat(html).contains("artigo 90 do Código de Processo Civil");
        assertThat(html).contains("artigo 922 do Código de Processo Civil");
    }

    @Test
    void montarQualificacaoInterlocutoria_usaNomesDasPartes() {
        String html = PeticaoHomologacaoAcordoService.montarQualificacaoInterlocutoriaHtml(List.of(), List.of());
        assertThat(html).contains("qualificacao-parte");
    }

    @Test
    void montarFechoHomologacao_incluiAdvogadoAutorEDemandados() {
        PessoaEntity condominio = new PessoaEntity();
        condominio.setNome("Condominio Terra Mundi Anápolis");
        condominio.setCpf("46619657000132");

        PessoaEntity reu1 = new PessoaEntity();
        reu1.setNome("Juliano Cesar Mendonça");
        reu1.setCpf("12345678901");

        PessoaEntity reu2 = new PessoaEntity();
        reu2.setNome("Adrielle Andrade de Lima Mendonca");
        reu2.setCpf("98765432100");

        ProcessoParteEntity autor = new ProcessoParteEntity();
        autor.setPessoa(condominio);
        ProcessoParteEntity demandado1 = new ProcessoParteEntity();
        demandado1.setPessoa(reu1);
        ProcessoParteEntity demandado2 = new ProcessoParteEntity();
        demandado2.setPessoa(reu2);

        String html = PeticaoHomologacaoAcordoService.montarFechoHomologacaoHtml(
                "Anápolis, 7 de julho de 2026",
                "Dr. Itamar Alexandre Felix Villa Real Junior",
                "OAB/GO 33.329",
                List.of(autor),
                List.of(demandado1, demandado2));

        assertThat(html).contains("Nestes termos");
        assertThat(html).contains("Dr. Itamar Alexandre Felix Villa Real Junior");
        assertThat(html).contains("OAB/GO 33.329");
        assertThat(html).contains("CONDOMINIO TERRA MUNDI ANÁPOLIS");
        assertThat(html).contains("CNPJ 46.619.657/0001-32");
        assertThat(html).contains("JULIANO CESAR MENDONÇA");
        assertThat(html).contains("CPF 123.456.789-01");
        assertThat(html).contains("ADRIELLE ANDRADE DE LIMA MENDONCA");
        assertThat(html).contains("CPF 987.654.321-00");
    }
}
