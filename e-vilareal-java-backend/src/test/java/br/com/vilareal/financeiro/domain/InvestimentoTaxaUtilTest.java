package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class InvestimentoTaxaUtilTest {

    @Test
    void taxaMensal_composta() {
        BigDecimal vi = new BigDecimal("50000");
        BigDecimal vf = new BigDecimal("51500");
        BigDecimal taxa = InvestimentoTaxaUtil.taxaMensalLiquida(vf, vi, 45);
        assertNotNull(taxa);
        assertTrue(taxa.doubleValue() > 0.019 && taxa.doubleValue() < 0.021);
    }

    @Test
    void tipoExtrato_creditoEhCompra() {
        assertEquals("C", BtgMovimentacaoParser.tipoExtratoParaNatureza("CREDITO"));
        assertEquals("V", BtgMovimentacaoParser.tipoExtratoParaNatureza("DEBITO"));
    }
}
