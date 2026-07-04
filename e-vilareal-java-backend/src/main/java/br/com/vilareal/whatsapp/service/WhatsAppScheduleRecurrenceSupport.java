package br.com.vilareal.whatsapp.service;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/** Geração de datas para agendamento WhatsApp em lote (recorrência mensal, fuso Brasília). */
public final class WhatsAppScheduleRecurrenceSupport {

    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter YEAR_MONTH = DateTimeFormatter.ofPattern("yyyy-MM");

    private WhatsAppScheduleRecurrenceSupport() {}

    /**
     * Gera um instante por mês entre {@code mesInicio} e {@code mesFim} (inclusive), sempre no
     * {@code diaDoMes} às {@code hora}:{@code minuto} em Brasília.
     * <p>
     * Se o dia não existir no mês (ex.: 31 em fevereiro), usa o <strong>último dia do mês</strong>.
     */
    public static List<Instant> gerarRecorrenciaMensal(
            int diaDoMes, int hora, int minuto, YearMonth mesInicio, YearMonth mesFim) {
        validarDiaHora(diaDoMes, hora, minuto);
        if (mesFim.isBefore(mesInicio)) {
            throw new IllegalArgumentException("Mês final deve ser igual ou posterior ao mês inicial");
        }

        List<Instant> out = new ArrayList<>();
        for (YearMonth ym = mesInicio; !ym.isAfter(mesFim); ym = ym.plusMonths(1)) {
            int dia = Math.min(diaDoMes, ym.lengthOfMonth());
            ZonedDateTime zdt =
                    ZonedDateTime.of(ym.getYear(), ym.getMonthValue(), dia, hora, minuto, 0, 0, ZONE_BRASILIA);
            out.add(zdt.toInstant());
        }
        return out;
    }

    public static YearMonth parseYearMonth(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Mês inválido");
        }
        try {
            return YearMonth.parse(value.trim(), YEAR_MONTH);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Mês inválido (use yyyy-MM): " + value);
        }
    }

    private static void validarDiaHora(int diaDoMes, int hora, int minuto) {
        if (diaDoMes < 1 || diaDoMes > 31) {
            throw new IllegalArgumentException("Dia do mês deve ser entre 1 e 31");
        }
        if (hora < 0 || hora > 23) {
            throw new IllegalArgumentException("Hora inválida");
        }
        if (minuto < 0 || minuto > 59) {
            throw new IllegalArgumentException("Minuto inválido");
        }
    }
}
