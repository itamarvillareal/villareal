package br.com.vilareal.citacao.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CitacaoLegendaNaoCitacaoUtilTest {

    @Test
    void citacaoNaoEfetivadaDireta() {
        assertTrue(CitacaoLegendaNaoCitacaoUtil.legendaIndicaRetornoInfrutifero(
                "Citação Não Efetivada - Para Fernanda Maria Silva"));
    }

    @Test
    void mandadoNaoCumpridoDireto() {
        assertTrue(CitacaoLegendaNaoCitacaoUtil.legendaIndicaRetornoInfrutifero("Mandado Não Cumprido"));
    }

    @Test
    void certidaoExpedidaComCitacaoFrustradaNoCorpo() {
        assertTrue(CitacaoLegendaNaoCitacaoUtil.legendaIndicaRetornoInfrutifero(
                "Certidão Expedida - Citação frustrada - sem resposta - Louanna Alves Dos Santos"));
    }

    @Test
    void certidaoExpedidaComCartaNaoEfetivada() {
        assertTrue(CitacaoLegendaNaoCitacaoUtil.legendaIndicaRetornoInfrutifero(
                "Certidão Expedida - *Certidão -A.R - Carta de citação não efetivada- UPJ"));
    }

    @Test
    void citacaoExpedidaNaoDispara() {
        assertFalse(CitacaoLegendaNaoCitacaoUtil.legendaIndicaRetornoInfrutifero(
                "Citação Expedida - Para (Polo Passivo) Rafael Da Silva Siqueira"));
    }

    @Test
    void intimacaoEfetivadaReferenciandoCitacaoNaoEfetivadaNaoDispara() {
        assertFalse(CitacaoLegendaNaoCitacaoUtil.legendaIndicaRetornoInfrutifero(
                "Intimação Efetivada - Adv(s). de Larissa (Referente à Mov. Citação Não Efetivada (09/10/2025))"));
    }

    @Test
    void juntadaPeticaoNaoDispara() {
        assertFalse(CitacaoLegendaNaoCitacaoUtil.legendaIndicaRetornoInfrutifero("Juntada -> Petição"));
    }
}
