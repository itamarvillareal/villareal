package br.com.vilareal.projudi;

import br.com.vilareal.projudi.ProjudiBuscaParteService.LinhaLista;
import br.com.vilareal.projudi.ProjudiBuscaParteService.PaginaLista;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Fixture reproduz a estrutura REAL observada nos HTMLs salvos pelo spike (table#Tabela,
 * thead com <td>, tbody#tabListaProcesso, linha opaca tr[id^=segredojus], links de
 * paginação com PosicaoPaginaAtual).
 */
class ProjudiBuscaParteServiceParserTest {

    private static final String HTML_LISTA = """
            <html><body>
            <table id="Tabela">
              <thead><tr>
                <td></td><td></td><td>N\u00famero</td><td>Partes</td><td>Distribui\u00e7\u00e3o</td><td>Selecionar</td>
              </tr></thead>
              <tbody id="tabListaProcesso">
                <tr class="TabelaLinha1" onclick="submete('613578617600646873962780961')">
                  <td align="center">1</td>
                  <td align="center"><input name="processos" type="checkbox" value="613578617600646873962780961"/></td>
                  <td>7138535-54</td>
                  <td>
                    <div class="coluna100"><b>Polo Ativo</b><div class="coluna80">LEILA CARLA SILVA RIBEIRO BORGES</div></div>
                    <div class="coluna100"><b>Polo Passivo</b><div class="coluna80">MARCOS NEILSON DA SILVA</div></div>
                  </td>
                  <td>02/05/2011 11:57:47</td>
                  <td></td>
                </tr>
                <tr id="segredojus613178607600646873963450556">
                  <td colspan="6"><div>Processo em segredo de justi\u00e7a. Para maiores informa\u00e7\u00f5es, comparecer \u00e0
                    Serventia <b> "An\u00e1polis - Vara da Inf\u00e2ncia e Juventude C\u00edvel" </b> com o(s) documento(s)
                    que comprove(m) parte no processo.</div></td>
                </tr>
              </tbody>
            </table>
            <a href="BuscaProcesso?PaginaAtual=2&amp;Paginacao=true&amp;PosicaoPaginaAtual=0&amp;PassoBusca=1">Primeira</a>
            <b>| 1 |</b><a href="BuscaProcesso?PaginaAtual=2&amp;Paginacao=true&amp;PosicaoPaginaAtual=224&amp;PassoBusca=1">\u00daltima</a>
            </body></html>
            """;

    @Test
    void parseiaLinhaNormalComTokenSufixoPartesEData() {
        PaginaLista pagina = ProjudiBuscaParteService.parsePagina(HTML_LISTA, "teste");
        assertEquals(2, pagina.linhas().size());

        LinhaLista linha = pagina.linhas().get(0);
        assertFalse(linha.segredo());
        assertEquals("7138535-54", linha.numeroReduzido());
        assertEquals(LocalDateTime.of(2011, 5, 2, 11, 57, 47), linha.dataDistribuicao());
        assertEquals("613578617600646873962780961", linha.idProcessoToken());
        assertEquals("873962780961", linha.idProcessoSufixo());
        assertEquals(List.of("LEILA CARLA SILVA RIBEIRO BORGES"), linha.partesAtivo());
        assertEquals(List.of("MARCOS NEILSON DA SILVA"), linha.partesPassivo());
    }

    @Test
    void parseiaLinhaDeSegredoComServentia() {
        PaginaLista pagina = ProjudiBuscaParteService.parsePagina(HTML_LISTA, "teste");
        LinhaLista segredo = pagina.linhas().get(1);
        assertTrue(segredo.segredo());
        assertNull(segredo.numeroReduzido());
        assertNull(segredo.idProcessoToken());
        assertEquals("An\u00e1polis - Vara da Inf\u00e2ncia e Juventude C\u00edvel", segredo.serventiaSegredo());
    }

    @Test
    void extraiPosicaoDaUltimaPaginaDoLinkUltima() {
        PaginaLista pagina = ProjudiBuscaParteService.parsePagina(HTML_LISTA, "teste");
        assertEquals(224, pagina.posicaoUltimaPagina());
    }

    @Test
    void semResultadoRetornaListaVazia() {
        PaginaLista pagina = ProjudiBuscaParteService.parsePagina(
                "<html><body>Nenhum Processo foi localizado</body></html>", "teste");
        assertTrue(pagina.linhas().isEmpty());
        assertEquals(0, pagina.posicaoUltimaPagina());
    }

    @Test
    void estruturaDesconhecidaFalhaAltoComExcecaoEspecifica() {
        // Página inesperada NÃO pode virar "0 processos" — corromperia a baseline. A varredura
        // converte esta exceção em erro_codigo=ESTRUTURA_INESPERADA sem derrubar o tick.
        assertThrows(ProjudiEstruturaInesperadaException.class,
                () -> ProjudiBuscaParteService.parsePagina("<html><body><p>WAF block</p></body></html>", "teste"));
    }

    @Test
    void parseiaDataSemHora() {
        assertEquals(LocalDateTime.of(2011, 5, 2, 0, 0),
                ProjudiBuscaParteService.parseDataDistribuicao("02/05/2011"));
        assertNull(ProjudiBuscaParteService.parseDataDistribuicao("inválida"));
        assertNull(ProjudiBuscaParteService.parseDataDistribuicao(null));
    }
}
