package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoRenderContextTest {

    @Test
    void limparMarcadorPedidoRemoveAlíneaColada() {
        assertThat(DocumentoRenderContext.limparMarcadorPedido("a)Seja a movimentação bloqueada."))
                .isEqualTo("Seja a movimentação bloqueada.");
    }

    @Test
    void limparMarcadorPedidoRemoveAlíneaComEspaco() {
        assertThat(DocumentoRenderContext.limparMarcadorPedido("b) Seja deferido."))
                .isEqualTo("Seja deferido.");
    }

    @Test
    void normalizarPedidosPreservaTextoSemMarcador() {
        assertThat(DocumentoRenderContext.normalizarPedidos(List.of("Seja a movimentação 114 bloqueada.")))
                .containsExactly("Seja a movimentação 114 bloqueada.");
    }

    @Test
    void htmlSecaoTemTextoIgnoraTagsVazias() {
        assertThat(DocumentoRenderContext.htmlSecaoTemTexto("<p></p>")).isFalse();
        assertThat(DocumentoRenderContext.htmlSecaoTemTexto("<p>Conteúdo</p>")).isTrue();
    }

    @Test
    void legadoIgnoraSecaoSemTextoVisivel() {
        var request = new DocumentoGerarRequest(
                "Endereçamento",
                null,
                "<p>Preâmbulo</p>",
                List.of(
                        new DocumentoGerarRequest.SecaoPeticao("DOS FATOS", "<p>Fatos</p>"),
                        new DocumentoGerarRequest.SecaoPeticao("DO DIREITO", "<p></p>")),
                List.of("Pedido"),
                "Anápolis/GO",
                java.time.LocalDate.now(),
                null);

        var ctx = DocumentoRenderContext.legado(request);
        assertThat(ctx.secoesLegado()).hasSize(1);
        assertThat(ctx.secoesLegado().getFirst().titulo()).isEqualTo("DOS FATOS");
    }
}
