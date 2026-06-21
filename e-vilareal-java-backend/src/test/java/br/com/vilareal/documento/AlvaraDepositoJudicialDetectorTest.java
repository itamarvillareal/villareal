package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AlvaraDepositoJudicialDetectorTest {

    @Test
    void reconhecePadraoV49DepositoJudicial() {
        assertThat(AlvaraDepositoJudicialDetector.pareceDepositoJudicialOuAlvara("Credito Deposito Judicial"))
                .isTrue();
    }

    @Test
    void reconheceTermosAlvaraELevantamento() {
        assertThat(AlvaraDepositoJudicialDetector.pareceDepositoJudicialOuAlvara("Pagamento alvará execução"))
                .isTrue();
        assertThat(AlvaraDepositoJudicialDetector.pareceDepositoJudicialOuAlvara("Levantamento judicial"))
                .isTrue();
    }

    @Test
    void ignoraCreditoGenericoSemTermos() {
        assertThat(AlvaraDepositoJudicialDetector.pareceDepositoJudicialOuAlvara("PIX MARIA ALUGUEL"))
                .isFalse();
    }
}
