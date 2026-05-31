package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PdfTextoExtracaoUtilTest {

    @Test
    void precisaOcr_quandoTextoAbaixoDoLimiar() {
        assertTrue(PdfTextoExtracaoUtil.precisaOcr("", 32));
        assertTrue(PdfTextoExtracaoUtil.precisaOcr("   abc   ", 32));
        assertFalse(PdfTextoExtracaoUtil.precisaOcr("x".repeat(40), 32));
    }

    @Test
    void contarPaginasComOcrAdicionado_detectaPaginaNova() {
        byte[] antes = "%PDF-1.4\n".getBytes();
        byte[] depois = "%PDF-1.4\n".getBytes();
        // PDFs inválidos/minimalistas retornam 0 — smoke test de não-lançar exceção
        assertEquals(0, PdfTextoExtracaoUtil.contarPaginasComOcrAdicionado(antes, depois));
    }
}
