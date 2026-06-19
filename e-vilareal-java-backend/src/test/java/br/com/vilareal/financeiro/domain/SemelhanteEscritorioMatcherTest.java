package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SemelhanteEscritorioMatcherTest {

    private static final String DESC = "recebimento pix aloisio savio";

    @Test
    void parear_umPendente_umHistorico() {
        var hist = List.of(slot(1L, LocalDate.of(2026, 1, 10), 10L, 100L));
        var pend = List.of(pend(50L, LocalDate.of(2026, 2, 5)));
        var matches = SemelhanteEscritorioMatcher.parear(pend, hist);
        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).sugestaoClienteId()).isEqualTo(10L);
        assertThat(matches.get(0).sugestaoProcessoId()).isEqualTo(100L);
    }

    @Test
    void parear_doisPendentes_doisHistoricosComVinculosDiferentes() {
        var hist = List.of(
                slot(1L, LocalDate.of(2026, 1, 20), 10L, 100L),
                slot(2L, LocalDate.of(2026, 1, 5), 20L, 200L));
        var pend = List.of(
                pend(50L, LocalDate.of(2026, 2, 5)),
                pend(51L, LocalDate.of(2026, 2, 10)));
        var matches = SemelhanteEscritorioMatcher.parear(pend, hist);
        assertThat(matches).hasSize(2);
        assertThat(matches.get(0).sugestaoClienteId()).isEqualTo(10L);
        assertThat(matches.get(0).sugestaoProcessoId()).isEqualTo(100L);
        assertThat(matches.get(1).sugestaoClienteId()).isEqualTo(20L);
        assertThat(matches.get(1).sugestaoProcessoId()).isEqualTo(200L);
    }

    @Test
    void parear_tresPendentes_doisHistoricos_soDoisRecebemSugestao() {
        var hist = List.of(
                slot(1L, LocalDate.of(2026, 1, 20), 10L, 100L),
                slot(2L, LocalDate.of(2026, 1, 5), 20L, 200L));
        var pend = List.of(
                pend(50L, LocalDate.of(2026, 2, 1)),
                pend(51L, LocalDate.of(2026, 2, 2)),
                pend(52L, LocalDate.of(2026, 2, 3)));
        assertThat(SemelhanteEscritorioMatcher.parear(pend, hist)).hasSize(2);
    }

    @Test
    void parear_valorDiferente_naoPareia() {
        var hist = List.of(slot(1L, LocalDate.of(2026, 1, 10), 10L, 100L));
        var pend = List.of(new SemelhanteEscritorioMatcher.PendenteItem(
                50L,
                LocalDate.of(2026, 2, 5),
                "Recebimento Pix Aloisio",
                DESC,
                new BigDecimal("1500.00"),
                756,
                "Sicoob"));
        assertThat(SemelhanteEscritorioMatcher.parear(pend, hist)).isEmpty();
    }

    private static SemelhanteEscritorioMatcher.HistoricoSlot slot(
            Long id, LocalDate data, Long clienteId, Long processoId) {
        return new SemelhanteEscritorioMatcher.HistoricoSlot(
                id, data, DESC, new BigDecimal("1440.00"), 756, clienteId, processoId);
    }

    private static SemelhanteEscritorioMatcher.PendenteItem pend(Long id, LocalDate data) {
        return new SemelhanteEscritorioMatcher.PendenteItem(
                id, data, "Recebimento Pix Aloisio Savio", DESC, new BigDecimal("1440.00"), 756, "Sicoob");
    }
}
