package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.domain.PeriodoCadencia;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.common.exception.BusinessRuleException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Cálculo básico de {@code proxima_execucao} na criação/edição/retomada e após sucesso do monitor.
 *
 * <p>TODO Fase 3: janela ({@code janelaInicio}/{@code janelaFim}), {@code apenasDiasUteis}
 * e {@code considerarFeriados} no agendamento da próxima execução.</p>
 */
public final class AgendamentoProximaExecucaoCalculo {

    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");

    private AgendamentoProximaExecucaoCalculo() {}

    public static void validarCadencia(
            TipoCadencia tipoCadencia,
            Integer intervaloMinutos,
            String horariosFixos,
            PeriodoCadencia periodo,
            LocalTime periodoHorario) {
        if (tipoCadencia == null) {
            throw new BusinessRuleException("tipoCadencia é obrigatório.");
        }
        if (tipoCadencia == TipoCadencia.INTERVALO) {
            if (intervaloMinutos == null || intervaloMinutos <= 0) {
                throw new BusinessRuleException("INTERVALO exige intervaloMinutos maior que zero.");
            }
            return;
        }
        if (tipoCadencia == TipoCadencia.PERIODICO) {
            if (periodo == null) {
                throw new BusinessRuleException("PERIODICO exige periodo.");
            }
            if (periodoHorario == null) {
                throw new BusinessRuleException("PERIODICO exige periodoHorario.");
            }
            return;
        }
        if (!org.springframework.util.StringUtils.hasText(horariosFixos)) {
            throw new BusinessRuleException("HORARIOS_FIXOS exige horariosFixos não vazio.");
        }
        parseHorariosFixos(horariosFixos);
    }

    /** Primeira próxima execução (criação, edição, retomada). */
    public static LocalDateTime calcularProxima(AgendamentoConsultaEntity agendamento, LocalDateTime referencia) {
        return calcularProximaInterno(agendamento, referencia, false);
    }

    /** Avanço após execução bem-sucedida (usa {@code proxima_execucao} anterior para PERIODICO). */
    public static LocalDateTime calcularProximaAposSucesso(
            AgendamentoConsultaEntity agendamento, LocalDateTime referencia) {
        return calcularProximaInterno(agendamento, referencia, true);
    }

    private static LocalDateTime calcularProximaInterno(
            AgendamentoConsultaEntity agendamento, LocalDateTime referencia, boolean aposSucesso) {
        if (agendamento.getTipoCadencia() == TipoCadencia.INTERVALO) {
            return referencia.plusMinutes(agendamento.getIntervaloMinutos());
        }
        if (agendamento.getTipoCadencia() == TipoCadencia.PERIODICO) {
            PeriodoCadencia periodo = agendamento.getPeriodo();
            LocalTime horario = agendamento.getPeriodoHorario();
            if (aposSucesso) {
                LocalDateTime base =
                        agendamento.getProximaExecucao() != null ? agendamento.getProximaExecucao() : referencia;
                return avancarPeriodo(base, periodo, horario);
            }
            return semearPeriodico(referencia, periodo, horario);
        }
        List<LocalTime> horarios = parseHorariosFixos(agendamento.getHorariosFixos());
        LocalDate dia = referencia.toLocalDate();
        LocalTime agora = referencia.toLocalTime();
        for (LocalTime h : horarios) {
            if (h.isAfter(agora)) {
                return LocalDateTime.of(dia, h);
            }
        }
        return LocalDateTime.of(dia.plusDays(1), horarios.getFirst());
    }

    static LocalDateTime semearPeriodico(LocalDateTime referencia, PeriodoCadencia periodo, LocalTime horario) {
        LocalDateTime hojeNoHorario = LocalDateTime.of(referencia.toLocalDate(), horario);
        if (hojeNoHorario.isAfter(referencia)) {
            return hojeNoHorario;
        }
        return avancarPeriodo(hojeNoHorario, periodo, horario);
    }

    static LocalDateTime avancarPeriodo(LocalDateTime base, PeriodoCadencia periodo, LocalTime horario) {
        LocalDate proximaData =
                switch (periodo) {
                    case DIARIO -> base.toLocalDate().plusDays(1);
                    case SEMANAL -> base.toLocalDate().plusDays(7);
                    case QUINZENAL -> base.toLocalDate().plusDays(14);
                    case MENSAL -> base.toLocalDate().plusMonths(1);
                    case BIMESTRAL -> base.toLocalDate().plusMonths(2);
                    case SEMESTRAL -> base.toLocalDate().plusMonths(6);
                    case ANUAL -> base.toLocalDate().plusYears(1);
                };
        return LocalDateTime.of(proximaData, horario);
    }

    public static String resumoCadencia(AgendamentoConsultaEntity agendamento) {
        if (agendamento.getTipoCadencia() == TipoCadencia.INTERVALO) {
            return "a cada " + agendamento.getIntervaloMinutos() + " min";
        }
        if (agendamento.getTipoCadencia() == TipoCadencia.PERIODICO) {
            String hora = agendamento.getPeriodoHorario() != null
                    ? agendamento.getPeriodoHorario().format(HORA)
                    : "?";
            return rotuloPeriodo(agendamento.getPeriodo()) + " às " + hora;
        }
        return agendamento.getHorariosFixos();
    }

    private static String rotuloPeriodo(PeriodoCadencia periodo) {
        if (periodo == null) {
            return "periódico";
        }
        return switch (periodo) {
            case DIARIO -> "diário";
            case SEMANAL -> "semanal";
            case QUINZENAL -> "quinzenal";
            case MENSAL -> "mensal";
            case BIMESTRAL -> "bimestral";
            case SEMESTRAL -> "semestral";
            case ANUAL -> "anual";
        };
    }

    static List<LocalTime> parseHorariosFixos(String horariosFixos) {
        String[] partes = horariosFixos.split(",");
        List<LocalTime> horarios = new ArrayList<>();
        for (String parte : partes) {
            String t = parte.trim();
            if (t.isEmpty()) {
                continue;
            }
            try {
                horarios.add(LocalTime.parse(t, HORA));
            } catch (DateTimeParseException e) {
                throw new BusinessRuleException("horariosFixos inválido (use HH:mm separados por vírgula): " + t);
            }
        }
        if (horarios.isEmpty()) {
            throw new BusinessRuleException("HORARIOS_FIXOS exige ao menos um horário HH:mm.");
        }
        Collections.sort(horarios);
        return horarios;
    }
}
