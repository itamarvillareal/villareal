package br.com.vilareal.notificacao.application;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NotificacaoMovimentacaoResumoBuilderTest {

    @Test
    void umaNova_retornaLegenda() {
        MovimentacaoMonitoradaEntity e = new MovimentacaoMonitoradaEntity();
        e.setLegenda("Juntada de petição");

        assertThat(NotificacaoMovimentacaoResumoBuilder.montarResumo(List.of(e)))
                .isEqualTo("Juntada de petição");
    }

    @Test
    void variasNovas_resumoComContagemEMaisRecente() {
        MovimentacaoMonitoradaEntity antiga = mov(1L, "Antiga", LocalDateTime.of(2026, 6, 1, 10, 0));
        MovimentacaoMonitoradaEntity recente = mov(2L, "Decisão recente", LocalDateTime.of(2026, 6, 4, 15, 0));

        assertThat(NotificacaoMovimentacaoResumoBuilder.montarResumo(List.of(antiga, recente)))
                .isEqualTo("2 novas movimentações (mais recente: Decisão recente)");
    }

    private static MovimentacaoMonitoradaEntity mov(Long id, String legenda, LocalDateTime data) {
        MovimentacaoMonitoradaEntity e = new MovimentacaoMonitoradaEntity();
        e.setId(id);
        e.setLegenda(legenda);
        e.setDataMovimentacao(data);
        return e;
    }
}
