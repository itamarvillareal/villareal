package br.com.vilareal.notificacao.application;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;

/** Texto conciso de movimentações novas para template WhatsApp. */
public final class NotificacaoMovimentacaoResumoBuilder {

    private NotificacaoMovimentacaoResumoBuilder() {}

    public static String montarResumo(List<MovimentacaoMonitoradaEntity> novas) {
        if (novas == null || novas.isEmpty()) {
            return "";
        }
        if (novas.size() == 1) {
            String legenda = novas.getFirst().getLegenda();
            return StringUtils.hasText(legenda) ? legenda.trim() : "Nova movimentação";
        }
        MovimentacaoMonitoradaEntity maisRecente = novas.stream()
                .max(Comparator.comparing(
                                MovimentacaoMonitoradaEntity::getDataMovimentacao,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(
                                MovimentacaoMonitoradaEntity::getId,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(novas.getLast());
        String legendaRecente = maisRecente.getLegenda();
        if (!StringUtils.hasText(legendaRecente)) {
            legendaRecente = "—";
        } else {
            legendaRecente = legendaRecente.trim();
        }
        return novas.size() + " novas movimentações (mais recente: " + legendaRecente + ")";
    }
}
