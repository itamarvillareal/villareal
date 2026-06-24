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
}
