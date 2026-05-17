package br.com.vilareal.financeiro.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/**
 * Normalização de datas de lançamento para matching de compensação bancária.
 * Sexta, sábado e domingo pertencem à janela do próximo dia útil (segunda).
 */
public final class CompensacaoDateUtils {

    private CompensacaoDateUtils() {}

    /**
     * Normaliza a data para o dia útil de referência usado no pareamento.
     * Sexta, sábado e domingo → segunda seguinte; demais dias → a própria data.
     */
    public static LocalDate normalizarParaDiaUtil(LocalDate data) {
        if (data == null) {
            return null;
        }
        return switch (data.getDayOfWeek()) {
            case FRIDAY, SATURDAY, SUNDAY -> data.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
            default -> data;
        };
    }

    /** Duas datas são equivalentes para compensação após normalização. */
    public static boolean mesmoDiaUtilBancario(LocalDate a, LocalDate b) {
        if (a == null || b == null) {
            return false;
        }
        return normalizarParaDiaUtil(a).equals(normalizarParaDiaUtil(b));
    }
}
