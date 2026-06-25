package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class BtgMovimentacaoParserImpostosTest {

    @Test
    void isImpostoGenericoSemProduto_detectaIrrfSolto() {
        assertTrue(BtgMovimentacaoParser.isImpostoGenericoSemProduto("IRRF"));
        assertFalse(BtgMovimentacaoParser.isImpostoGenericoSemProduto("IRRF - CDB BANCO ORIGINAL S/A - Venc.: 2026-06-24"));
    }

    @Test
    void extrairVencimentoExtrato() {
        assertEquals(
                "2026-06-24",
                BtgMovimentacaoParser.extrairVencimentoExtrato("IOF - CDB BANCO ORIGINAL S/A - Venc.: 2026-06-24"));
        assertEquals(
                "2026-06",
                BtgMovimentacaoParser.extrairVencimentoExtrato("IRRF - CDB BANCO ORIGINAL S/A - Venc.: 2026-06"));
    }

    @Test
    void emissoresInvestimentoCompat() {
        assertTrue(BtgMovimentacaoParser.emissoresInvestimentoCompat("BANCO ORIGINAL S/A", "BANCO ORIGINAL S/A"));
        assertFalse(BtgMovimentacaoParser.emissoresInvestimentoCompat(null, "BANCO ORIGINAL S/A"));
    }
}
