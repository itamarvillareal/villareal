package br.com.vilareal.financeiro.domain;

import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Pareia lançamentos pendentes com histórico vinculado da Conta Escritório (A)
 * pela chave descrição normalizada + valor exato + banco.
 * <p>
 * Quando há N pendentes e M históricos com a mesma chave, cada pendente recebe
 * um vínculo distinto (1:1 por ordem cronológica), evitando repetir o mesmo par
 * código+proc para todos quando o histórico tinha pares diferentes.
 */
public final class SemelhanteEscritorioMatcher {

    private SemelhanteEscritorioMatcher() {}

    public record HistoricoSlot(
            Long lancamentoId,
            LocalDate dataLancamento,
            String descricaoNorm,
            BigDecimal valor,
            Integer numeroBanco,
            Long clienteId,
            Long processoId) {}

    public record PendenteItem(
            Long lancamentoId,
            LocalDate dataLancamento,
            String descricao,
            String descricaoNorm,
            BigDecimal valor,
            Integer numeroBanco,
            String bancoNome) {}

    public record MatchResult(
            PendenteItem pendente,
            Long sugestaoClienteId,
            Long sugestaoProcessoId,
            Long referenciaHistoricoLancamentoId,
            LocalDate referenciaHistoricoData,
            int indicePar,
            int totalHistoricoChave,
            int totalPendenteChave) {}

    public static List<MatchResult> parear(List<PendenteItem> pendentes, List<HistoricoSlot> historico) {
        Map<String, List<HistoricoSlot>> histPorChave = new HashMap<>();
        for (HistoricoSlot h : historico) {
            if (!slotValido(h)) {
                continue;
            }
            histPorChave.computeIfAbsent(chave(h), k -> new ArrayList<>()).add(h);
        }
        for (List<HistoricoSlot> lista : histPorChave.values()) {
            lista.sort(Comparator.comparing(HistoricoSlot::dataLancamento, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(HistoricoSlot::lancamentoId, Comparator.nullsLast(Comparator.reverseOrder())));
        }

        Map<String, List<PendenteItem>> pendPorChave = new LinkedHashMap<>();
        for (PendenteItem p : pendentes) {
            if (!pendenteValido(p)) {
                continue;
            }
            pendPorChave.computeIfAbsent(chave(p), k -> new ArrayList<>()).add(p);
        }
        for (List<PendenteItem> lista : pendPorChave.values()) {
            lista.sort(Comparator.comparing(PendenteItem::dataLancamento, Comparator.nullsLast(Comparator.naturalOrder()))
                    .thenComparing(PendenteItem::lancamentoId, Comparator.nullsLast(Comparator.naturalOrder())));
        }

        List<MatchResult> out = new ArrayList<>();
        for (Map.Entry<String, List<PendenteItem>> entry : pendPorChave.entrySet()) {
            List<PendenteItem> pends = entry.getValue();
            List<HistoricoSlot> slots = histPorChave.getOrDefault(entry.getKey(), List.of());
            if (slots.isEmpty()) {
                continue;
            }
            int totalPend = pends.size();
            int totalHist = slots.size();
            for (int i = 0; i < pends.size(); i++) {
                if (i >= slots.size()) {
                    break;
                }
                PendenteItem p = pends.get(i);
                HistoricoSlot h = slots.get(i);
                out.add(new MatchResult(
                        p,
                        h.clienteId(),
                        h.processoId(),
                        h.lancamentoId(),
                        h.dataLancamento(),
                        i + 1,
                        totalHist,
                        totalPend));
            }
        }
        return out;
    }

    static String chave(HistoricoSlot h) {
        return chave(h.descricaoNorm(), h.valor(), h.numeroBanco());
    }

    static String chave(PendenteItem p) {
        return chave(p.descricaoNorm(), p.valor(), p.numeroBanco());
    }

    public static String chave(String descricaoNorm, BigDecimal valor, Integer numeroBanco) {
        return String.valueOf(numeroBanco != null ? numeroBanco : 0)
                + "|"
                + String.valueOf(descricaoNorm).trim().toUpperCase(Locale.ROOT)
                + "|"
                + valorCentavos(valor);
    }

    static long valorCentavos(BigDecimal valor) {
        if (valor == null) {
            return 0L;
        }
        return valor.setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValue();
    }

    private static boolean slotValido(HistoricoSlot h) {
        return h != null
                && h.lancamentoId() != null
                && h.clienteId() != null
                && h.processoId() != null
                && StringUtils.hasText(h.descricaoNorm())
                && h.valor() != null
                && h.numeroBanco() != null;
    }

    private static boolean pendenteValido(PendenteItem p) {
        return p != null
                && p.lancamentoId() != null
                && StringUtils.hasText(p.descricaoNorm())
                && p.valor() != null
                && p.numeroBanco() != null;
    }
}
