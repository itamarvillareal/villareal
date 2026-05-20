package br.com.vilareal.financeiro.domain;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class CompensacaoParPrioridadeTest {

    @Test
    void pixInterbancarioPontuaAcimaDeDepositoMesmoBanco() {
        LancamentoFinanceiroEntity bbPix = lancamento("Pix - Enviado", 2);
        LancamentoFinanceiroEntity bbDeposito = lancamento("Credito Deposito Judicial", 2);
        LancamentoFinanceiroEntity itauPix = lancamento("PIX TRANSF ITAMAR 24/04", 1);

        int scoreInter = CompensacaoParPrioridade.pontuar(bbPix, itauPix);
        int scoreMesmoBanco = CompensacaoParPrioridade.pontuar(bbPix, bbDeposito);

        assertThat(scoreInter).isGreaterThan(scoreMesmoBanco);
        assertThat(CompensacaoParPrioridade.classificarFamiliaMovimento(bbPix.getDescricao(), null))
                .isEqualTo(CompensacaoParPrioridade.FamiliaMovimento.PIX);
        assertThat(CompensacaoParPrioridade.classificarFamiliaMovimento(itauPix.getDescricao(), null))
                .isEqualTo(CompensacaoParPrioridade.FamiliaMovimento.PIX);
        assertThat(CompensacaoParPrioridade.classificarFamiliaMovimento(bbDeposito.getDescricao(), null))
                .isEqualTo(CompensacaoParPrioridade.FamiliaMovimento.DEPOSITO);
    }

    @Test
    void transferenciaMesmaFamilia() {
        assertThat(
                        CompensacaoParPrioridade.mesmaFamiliaMovimento(
                                CompensacaoParPrioridade.classificarFamiliaMovimento("PIX TRANSF LEONARD", null),
                                CompensacaoParPrioridade.classificarFamiliaMovimento("PIX TRANSF ARIOSTO", null)))
                .isTrue();
    }

    private static LancamentoFinanceiroEntity lancamento(String descricao, int numeroBanco) {
        LancamentoFinanceiroEntity e = new LancamentoFinanceiroEntity();
        e.setDescricao(descricao);
        e.setNumeroBanco(numeroBanco);
        e.setValor(new BigDecimal("10934.30"));
        return e;
    }
}
