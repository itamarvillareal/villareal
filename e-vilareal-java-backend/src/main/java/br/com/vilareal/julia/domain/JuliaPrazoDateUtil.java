package br.com.vilareal.julia.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;

/** Cálculo de dias úteis para prazos da Júlia — apenas sábado e domingo (sem feriados). */
public final class JuliaPrazoDateUtil {

    private JuliaPrazoDateUtil() {}

    /**
     * Retrocede {@code n} dias úteis a partir de {@code data} (exclusivo do fim de semana).
     * Resultado sempre {@code <= data}.
     */
    public static LocalDate subtrairDiasUteis(LocalDate data, int n) {
        if (data == null) {
            return null;
        }
        if (n <= 0) {
            return data;
        }
        LocalDate cursor = data;
        int restantes = n;
        while (restantes > 0) {
            cursor = cursor.minusDays(1);
            if (!isFimDeSemana(cursor)) {
                restantes--;
            }
        }
        return cursor;
    }

    /** Prazo fatal em sábado/domingo rola para a segunda-feira seguinte. */
    public static LocalDate avancarParaProximoDiaUtil(LocalDate data) {
        if (data == null) {
            return null;
        }
        LocalDate cursor = data;
        while (isFimDeSemana(cursor)) {
            cursor = cursor.plusDays(1);
        }
        return cursor;
    }

    private static boolean isFimDeSemana(LocalDate data) {
        DayOfWeek dow = data.getDayOfWeek();
        return dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY;
    }
}
