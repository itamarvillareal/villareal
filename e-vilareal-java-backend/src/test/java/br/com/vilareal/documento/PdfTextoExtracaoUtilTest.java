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

    @Test
    void validarPdfSaida_rejeitaSaidaVaziaOuInvalida() {
        byte[] original = "%PDF-1.4\n".getBytes();
        var vazio = PdfTextoExtracaoUtil.validarPdfSaida(original, new byte[0]);
        assertFalse(vazio.aceito());
        var naoPdf = PdfTextoExtracaoUtil.validarPdfSaida(original, "<html>".getBytes());
        assertFalse(naoPdf.aceito());
    }

    @Test
    void validarContagemTextoPosOcr_modoRedo_permiteReducaoAte50Porcento() {
        assertTrue(PdfTextoExtracaoUtil.validarContagemTextoPosOcr(1000, 600, 32, true).aceito());
        assertFalse(PdfTextoExtracaoUtil.validarContagemTextoPosOcr(1000, 400, 32, true).aceito());
        assertFalse(PdfTextoExtracaoUtil.validarContagemTextoPosOcr(1000, 20, 32, true).aceito());
    }

    @Test
    void validarContagemTextoPosOcr_primeiroPasse_exigeTextoMaiorOuIgual() {
        assertTrue(PdfTextoExtracaoUtil.validarContagemTextoPosOcr(0, 500, 32, false).aceito());
        assertFalse(PdfTextoExtracaoUtil.validarContagemTextoPosOcr(500, 400, 32, false).aceito());
    }
}
