package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.RecorrenciaAgendamentoRequest;
import br.com.vilareal.whatsapp.dto.RecorrenciaMensalRequest;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Geração de datas para agendamento WhatsApp em lote (fuso Brasília). */
public final class WhatsAppScheduleRecurrenceSupport {

    public static final String TIPO_MENSAL = "MENSAL";
    public static final String TIPO_SEMANAL = "SEMANAL";
    public static final String TIPO_INTERVALO_DIA = "INTERVALO_DIA";

    public static final int MAX_OCORRENCIAS_LOTE = 200;

    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter YEAR_MONTH = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final DateTimeFormatter LOCAL_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private WhatsAppScheduleRecurrenceSupport() {}

    public static List<Instant> resolver(RecorrenciaAgendamentoRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Recorrência não informada");
        }
        String tipo = normalizarTipo(req.tipo());
        return switch (tipo) {
            case TIPO_MENSAL -> gerarMensal(req);
            case TIPO_SEMANAL -> gerarSemanal(req);
            case TIPO_INTERVALO_DIA -> gerarIntervaloNoDia(req);
            default -> throw new IllegalArgumentException("Tipo de recorrência inválido: " + req.tipo());
        };
    }

    /** Compatível com API legada ({@link RecorrenciaMensalRequest}). */
    public static List<Instant> resolverLegadoMensal(RecorrenciaMensalRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Recorrência mensal não informada");
        }
        YearMonth inicio = parseYearMonth(req.mesInicio());
        YearMonth fim = parseYearMonth(req.mesFim());
        return limitar(gerarRecorrenciaMensal(req.diaDoMes(), req.hora(), req.minuto(), inicio, fim));
    }

    /**
     * Gera um instante por mês entre {@code mesInicio} e {@code mesFim} (inclusive), sempre no
     * {@code diaDoMes} às {@code hora}:{@code minuto} em Brasília.
     * Se o dia não existir no mês (ex.: 31 em fevereiro), usa o último dia do mês.
     */
    public static List<Instant> gerarRecorrenciaMensal(
            int diaDoMes, int hora, int minuto, YearMonth mesInicio, YearMonth mesFim) {
        validarDiaHora(diaDoMes, hora, minuto);
        if (mesFim.isBefore(mesInicio)) {
            throw new IllegalArgumentException("Mês final deve ser igual ou posterior ao mês inicial");
        }
        List<Instant> out = new ArrayList<>();
        for (YearMonth ym = mesInicio; !ym.isAfter(mesFim); ym = ym.plusMonths(1)) {
            out.add(instanteNoDia(ym, diaDoMes, hora, minuto));
        }
        return out;
    }

    public static List<Instant> gerarRecorrenciaMensalQuantidade(
            int diaDoMes, int hora, int minuto, YearMonth mesInicio, int quantidadeMeses) {
        validarDiaHora(diaDoMes, hora, minuto);
        if (quantidadeMeses < 1) {
            throw new IllegalArgumentException("Quantidade de meses deve ser pelo menos 1");
        }
        List<Instant> out = new ArrayList<>();
        for (int i = 0; i < quantidadeMeses; i++) {
            out.add(instanteNoDia(mesInicio.plusMonths(i), diaDoMes, hora, minuto));
        }
        return out;
    }

    public static List<Instant> gerarRecorrenciaSemanal(
            LocalDate dataInicio, Set<DayOfWeek> diasSemana, int quantidadeSemanas, int hora, int minuto) {
        validarHoraMinuto(hora, minuto);
        if (dataInicio == null) {
            throw new IllegalArgumentException("Data inicial é obrigatória");
        }
        if (diasSemana == null || diasSemana.isEmpty()) {
            throw new IllegalArgumentException("Selecione ao menos um dia da semana");
        }
        if (quantidadeSemanas < 1) {
            throw new IllegalArgumentException("Quantidade de semanas deve ser pelo menos 1");
        }

        LocalDate fimExclusivo = dataInicio.plusWeeks(quantidadeSemanas);
        Set<Instant> unicos = new LinkedHashSet<>();
        for (LocalDate d = dataInicio; d.isBefore(fimExclusivo); d = d.plusDays(1)) {
            if (diasSemana.contains(d.getDayOfWeek())) {
                unicos.add(instanteNaData(d, hora, minuto));
            }
        }
        List<Instant> out = new ArrayList<>(unicos);
        out.sort(Comparator.naturalOrder());
        return out;
    }

    public static List<Instant> gerarIntervaloNoDia(
            LocalDate data,
            int horaInicio,
            int minutoInicio,
            int horaFim,
            int minutoFim,
            int intervaloMinutos) {
        validarHoraMinuto(horaInicio, minutoInicio);
        validarHoraMinuto(horaFim, minutoFim);
        if (data == null) {
            throw new IllegalArgumentException("Data é obrigatória");
        }
        if (intervaloMinutos < 1) {
            throw new IllegalArgumentException("Intervalo deve ser de pelo menos 1 minuto");
        }

        LocalDateTime inicio = LocalDateTime.of(data, java.time.LocalTime.of(horaInicio, minutoInicio));
        LocalDateTime fim = LocalDateTime.of(data, java.time.LocalTime.of(horaFim, minutoFim));
        if (fim.isBefore(inicio)) {
            throw new IllegalArgumentException("Hora final deve ser igual ou posterior à hora inicial");
        }

        List<Instant> out = new ArrayList<>();
        LocalDateTime cursor = inicio;
        while (!cursor.isAfter(fim)) {
            out.add(cursor.atZone(ZONE_BRASILIA).toInstant());
            cursor = cursor.plusMinutes(intervaloMinutos);
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

    public static LocalDate parseLocalDate(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Data inválida");
        }
        try {
            return LocalDate.parse(value.trim(), LOCAL_DATE);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Data inválida (use yyyy-MM-dd): " + value);
        }
    }

    public static DayOfWeek parseDiaSemana(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Dia da semana inválido");
        }
        String key = raw.trim().toUpperCase(Locale.ROOT)
                .replace("Ç", "C")
                .replace("Á", "A")
                .replace("É", "E");
        return switch (key) {
            case "SEGUNDA", "SEG", "MON", "MONDAY" -> DayOfWeek.MONDAY;
            case "TERCA", "TER", "TUE", "TUESDAY" -> DayOfWeek.TUESDAY;
            case "QUARTA", "QUA", "WED", "WEDNESDAY" -> DayOfWeek.WEDNESDAY;
            case "QUINTA", "QUI", "THU", "THURSDAY" -> DayOfWeek.THURSDAY;
            case "SEXTA", "SEX", "FRI", "FRIDAY" -> DayOfWeek.FRIDAY;
            case "SABADO", "SAB", "SAT", "SATURDAY" -> DayOfWeek.SATURDAY;
            case "DOMINGO", "DOM", "SUN", "SUNDAY" -> DayOfWeek.SUNDAY;
            default -> throw new IllegalArgumentException("Dia da semana inválido: " + raw);
        };
    }

    public static Set<DayOfWeek> parseDiasSemana(List<String> dias) {
        if (dias == null || dias.isEmpty()) {
            return Set.of();
        }
        EnumSet<DayOfWeek> out = EnumSet.noneOf(DayOfWeek.class);
        for (String d : dias) {
            out.add(parseDiaSemana(d));
        }
        return out;
    }

    public static List<Instant> limitar(List<Instant> datas) {
        if (datas.size() <= MAX_OCORRENCIAS_LOTE) {
            return datas;
        }
        throw new IllegalArgumentException(
                "Recorrência geraria "
                        + datas.size()
                        + " envios; o limite é "
                        + MAX_OCORRENCIAS_LOTE
                        + ". Reduza o intervalo ou a quantidade.");
    }

    private static List<Instant> gerarMensal(RecorrenciaAgendamentoRequest req) {
        int dia = requerInt(req.diaDoMes(), "Dia do mês");
        int hora = requerInt(req.hora(), "Hora");
        int minuto = requerInt(req.minuto(), "Minuto");
        YearMonth inicio = parseYearMonth(req.mesInicio());

        List<Instant> datas;
        if (req.quantidadeMeses() != null && req.quantidadeMeses() > 0) {
            datas = gerarRecorrenciaMensalQuantidade(dia, hora, minuto, inicio, req.quantidadeMeses());
        } else if (req.mesFim() != null && !req.mesFim().isBlank()) {
            datas = gerarRecorrenciaMensal(dia, hora, minuto, inicio, parseYearMonth(req.mesFim()));
        } else {
            throw new IllegalArgumentException("Informe quantidade de meses ou mês final");
        }
        return limitar(datas);
    }

    private static List<Instant> gerarSemanal(RecorrenciaAgendamentoRequest req) {
        LocalDate inicio = parseLocalDate(req.dataInicio());
        int semanas = requerInt(req.quantidadeSemanas(), "Quantidade de semanas");
        int hora = requerInt(req.hora(), "Hora");
        int minuto = requerInt(req.minuto(), "Minuto");
        Set<DayOfWeek> dias = parseDiasSemana(req.diasSemana());
        return limitar(gerarRecorrenciaSemanal(inicio, dias, semanas, hora, minuto));
    }

    private static List<Instant> gerarIntervaloNoDia(RecorrenciaAgendamentoRequest req) {
        LocalDate data = parseLocalDate(req.data());
        int horaIni = requerInt(req.horaInicio(), "Hora inicial");
        int minIni = requerInt(req.minutoInicio(), "Minuto inicial");
        int horaFim = requerInt(req.horaFim(), "Hora final");
        int minFim = requerInt(req.minutoFim(), "Minuto final");
        int intervalo = requerInt(req.intervaloMinutos(), "Intervalo em minutos");
        return limitar(gerarIntervaloNoDia(data, horaIni, minIni, horaFim, minFim, intervalo));
    }

    private static Instant instanteNoDia(YearMonth ym, int diaDoMes, int hora, int minuto) {
        int dia = Math.min(diaDoMes, ym.lengthOfMonth());
        return instanteNaData(LocalDate.of(ym.getYear(), ym.getMonthValue(), dia), hora, minuto);
    }

    private static Instant instanteNaData(LocalDate data, int hora, int minuto) {
        return ZonedDateTime.of(data.getYear(), data.getMonthValue(), data.getDayOfMonth(), hora, minuto, 0, 0, ZONE_BRASILIA)
                .toInstant();
    }

    private static String normalizarTipo(String tipo) {
        if (tipo == null || tipo.isBlank()) {
            throw new IllegalArgumentException("Tipo de recorrência é obrigatório");
        }
        return tipo.trim().toUpperCase(Locale.ROOT);
    }

    private static int requerInt(Integer value, String campo) {
        if (value == null) {
            throw new IllegalArgumentException(campo + " é obrigatório");
        }
        return value;
    }

    private static void validarDiaHora(int diaDoMes, int hora, int minuto) {
        if (diaDoMes < 1 || diaDoMes > 31) {
            throw new IllegalArgumentException("Dia do mês deve ser entre 1 e 31");
        }
        validarHoraMinuto(hora, minuto);
    }

    private static void validarHoraMinuto(int hora, int minuto) {
        if (hora < 0 || hora > 23) {
            throw new IllegalArgumentException("Hora inválida");
        }
        if (minuto < 0 || minuto > 59) {
            throw new IllegalArgumentException("Minuto inválido");
        }
    }
}
