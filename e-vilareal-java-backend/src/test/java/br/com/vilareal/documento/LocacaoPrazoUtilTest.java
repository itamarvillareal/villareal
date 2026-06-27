package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LocacaoPrazoUtilTest {

    @Test
    void calcularMesesLocacao_seisMesesEntreMaioENovembro() {
        assertThat(LocacaoPrazoUtil.calcularMesesLocacao(LocalDate.of(2025, 5, 30), LocalDate.of(2025, 11, 30)))
                .isEqualTo(6);
    }

    @Test
    void calcularMesesLocacao_trezeMesesQuandoFimNoAnoSeguinte() {
        assertThat(LocacaoPrazoUtil.calcularMesesLocacao(LocalDate.of(2025, 5, 30), LocalDate.of(2026, 6, 30)))
                .isEqualTo(13);
    }

    @Test
    void calcularMesesLocacao_somaUmMesQuandoDiaFinalMaior() {
        assertThat(LocacaoPrazoUtil.calcularMesesLocacao(LocalDate.of(2025, 5, 10), LocalDate.of(2025, 6, 15)))
                .isEqualTo(2);
    }

    @Test
    void formatarPrazoMeses_singularEPlural() {
        assertThat(LocacaoPrazoUtil.formatarPrazoMeses(1)).isEqualTo("1 mês");
        assertThat(LocacaoPrazoUtil.formatarPrazoMeses(6)).isEqualTo("6 meses");
    }

    @Test
    void substituirPrazoLocacaoHardcoded_trocaDozeMesesFixo() {
        String template =
                "O prazo da locação é de 12 meses, iniciando no dia 30 de maio de 2025 e terminando no dia 30 de novembro de 2025";

        String out = LocacaoPrazoUtil.substituirPrazoLocacaoHardcoded(template, "6 meses");

        assertThat(out).contains("é de 6 meses");
        assertThat(out).doesNotContain("12 meses");
    }
}
