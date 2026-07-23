package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoReformatarServiceMesclarTest {

    @Test
    void mesclarConteudoReformatado_preservaCamposEstruturadosDoJsonOriginal() {
        DocumentoReformatarConteudoRequest base = new DocumentoReformatarConteudoRequest(
                "MERITÍSSIMO JUÍZO",
                "6003951-79.2025.8.09.0006",
                "Anápolis, estado de Goiás",
                "2026-07-23",
                "PEDIDO TESTE",
                "<p>Preâmbulo original.</p>",
                List.of(new DocumentoReformatarConteudoRequest.SecaoConteudo("I - FATOS", "SUB", "<p>Texto.</p>")),
                "",
                null,
                null,
                "<div>corpo editor</div>",
                42L);

        DocumentoReformatarConteudoRequest fromEditor = new DocumentoReformatarConteudoRequest(
                "",
                "",
                "",
                null,
                "",
                "",
                List.of(),
                "",
                null,
                null,
                "<div>corpo editor</div>",
                42L);

        DocumentoReformatarConteudoRequest merged =
                DocumentoReformatarService.mesclarConteudoReformatado(base, fromEditor);

        assertThat(merged.enderecamento()).isEqualTo("MERITÍSSIMO JUÍZO");
        assertThat(merged.numeroProcesso()).isEqualTo("6003951-79.2025.8.09.0006");
        assertThat(merged.preambulo()).contains("Preâmbulo original");
        assertThat(merged.secoes()).hasSize(1);
        assertThat(merged.processoId()).isEqualTo(42L);
    }
}
