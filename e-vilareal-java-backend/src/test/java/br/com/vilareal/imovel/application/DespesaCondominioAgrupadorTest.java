package br.com.vilareal.imovel.application;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DespesaCondominioAgrupadorTest {

    @Test
    void valorEstimadoUsaUltimoMesDedupado() {
        var serie = List.of(
                new DespesaCondominioAgrupador.SerieItem("2026-02", new BigDecimal("883.13"), "A"),
                new DespesaCondominioAgrupador.SerieItem("2026-03", new BigDecimal("883.13"), "A"),
                new DespesaCondominioAgrupador.SerieItem("2026-04", new BigDecimal("902.53"), "B"),
                new DespesaCondominioAgrupador.SerieItem("2026-05", new BigDecimal("780.00"), "B"));

        assertThat(DespesaCondominioAgrupador.valorEstimadoRobusto(serie))
                .isEqualByComparingTo("780.00");
    }
}
