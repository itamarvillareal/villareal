package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiPeticaoOpcoesConfirmacaoTest {

    private static final String HTML =
            """
            <form id="Formulario">
              <input type="hidden" name="__Pedido__" value="123">
              <input type="checkbox" name="Urgente" value="true"
                id="chkUrg"> Envolve pedido de urgência (Tutelas provisórias, liminares…)
              <label for="chkLib">
                <input type="checkbox" name="PedidoLiberdade" value="true" id="chkLib">
                Pedido de Liberdade
              </label>
              <input type="submit" name="imgConcluir" value="Concluir">
            </form>
            """;

    @Test
    void aplicar_nenhumaOpcao_mantemCorpo() {
        String base = "PaginaAtual=5&__Pedido__=123&PaginaAnterior=-2&TituloPagina=null&imgConcluir=Concluir";
        assertEquals(base, ProjudiPeticaoOpcoesConfirmacao.PADRAO.aplicarNoCorpoPasso11(base, HTML));
    }

    @Test
    void aplicar_urgenciaELiberdade_anexaParametros() {
        String base = "PaginaAtual=5&__Pedido__=123&PaginaAnterior=-2&TituloPagina=null&imgConcluir=Concluir";
        String corpo = new ProjudiPeticaoOpcoesConfirmacao(true, true).aplicarNoCorpoPasso11(base, HTML);
        assertTrue(corpo.contains("&Urgente=true"), corpo);
        assertTrue(corpo.contains("&PedidoLiberdade=true"), corpo);
        assertTrue(corpo.endsWith("&imgConcluir=Concluir") || corpo.contains("imgConcluir=Concluir"), corpo);
    }

    @Test
    void localizarPorRotulo_urgencia() {
        var chk = ProjudiPeticaoOpcoesConfirmacao.localizarCheckboxPorRotulo(HTML, java.util.List.of("urgencia"));
        assertTrue(chk.isPresent());
        assertEquals("Urgente", chk.get().name());
    }

    @Test
    void localizarPorRotulo_liberdade() {
        var chk = ProjudiPeticaoOpcoesConfirmacao.localizarCheckboxPorRotulo(HTML, java.util.List.of("liberdade"));
        assertTrue(chk.isPresent());
        assertEquals("PedidoLiberdade", chk.get().name());
    }

    @Test
    void fallback_quandoHtmlVazio() {
        String base = "PaginaAtual=5&__Pedido__=1&PaginaAnterior=-2&TituloPagina=null&imgConcluir=Concluir";
        String corpo = new ProjudiPeticaoOpcoesConfirmacao(true, false).aplicarNoCorpoPasso11(base, null);
        assertTrue(corpo.contains("&Urgente=true"), corpo);
        assertFalse(corpo.contains("PedidoLiberdade"), corpo);
    }

    @Test
    void deFlags_orLogico() {
        var op = ProjudiPeticaoOpcoesConfirmacao.deFlags(
                java.util.List.of(false, true), java.util.List.of(false, false));
        assertTrue(op.pedidoUrgencia());
        assertFalse(op.pedidoLiberdade());
    }
}
