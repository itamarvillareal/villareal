package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.domain.PeriodoCadencia;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.notificacao.domain.CanalNotificacao;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

final class ConsultaPeriodicaCsvUtil {

    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATA = DateTimeFormatter.ISO_LOCAL_DATE;

    private ConsultaPeriodicaCsvUtil() {}

    static String formatBoolean(boolean valor) {
        return valor ? "true" : "false";
    }

    static boolean parseBooleanTolerante(String raw, boolean padraoSeVazio) {
        if (!StringUtils.hasText(raw)) {
            return padraoSeVazio;
        }
        String v = raw.trim().toLowerCase(Locale.ROOT);
        if (v.equals("true") || v.equals("1") || v.equals("sim") || v.equals("s")) {
            return true;
        }
        if (v.equals("false") || v.equals("0") || v.equals("nao") || v.equals("não") || v.equals("n")) {
            return false;
        }
        throw new IllegalArgumentException("Booleano inválido: " + raw);
    }

    static String formatHorariosFixosExport(String horariosFixos) {
        if (!StringUtils.hasText(horariosFixos)) {
            return "";
        }
        return AgendamentoProximaExecucaoCalculo.parseHorariosFixos(horariosFixos.replace('|', ',')).stream()
                .map(t -> t.format(HORA))
                .collect(Collectors.joining("|"));
    }

    static String parseHorariosFixosImport(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String csv = raw.trim().replace('|', ',');
        return AgendamentoProximaExecucaoCalculo.parseHorariosFixos(csv).stream()
                .map(t -> t.format(HORA))
                .collect(Collectors.joining(","));
    }

    static String formatHora(LocalTime hora) {
        return hora != null ? hora.format(HORA) : "";
    }

    static LocalTime parseHora(String raw, String campo) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        try {
            return LocalTime.parse(raw.trim(), HORA);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(campo + " inválido (use HH:mm): " + raw);
        }
    }

    static String formatValidoAte(LocalDateTime validoAte) {
        return validoAte != null ? validoAte.toLocalDate().format(DATA) : "";
    }

    static LocalDateTime parseValidoAte(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        try {
            LocalDate data = LocalDate.parse(raw.trim(), DATA);
            return data.atTime(23, 59, 59);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("valido_ate inválido (use yyyy-MM-dd): " + raw);
        }
    }

    static String formatDestinatarios(List<NotificacaoDestinatarioEntity> destinatarios) {
        if (destinatarios == null || destinatarios.isEmpty()) {
            return "";
        }
        return destinatarios.stream()
                .map(d -> d.getCanal().name() + ":" + d.getValor())
                .distinct()
                .sorted()
                .collect(Collectors.joining("|"));
    }

    static List<DestinatarioCsv> parseDestinatarios(String raw) {
        if (!StringUtils.hasText(raw)) {
            return List.of();
        }
        List<DestinatarioCsv> out = new ArrayList<>();
        Set<String> vistos = new LinkedHashSet<>();
        for (String parte : raw.split("\\|")) {
            String item = parte.trim();
            if (item.isEmpty()) {
                continue;
            }
            int sep = item.indexOf(':');
            if (sep <= 0 || sep >= item.length() - 1) {
                throw new IllegalArgumentException("destinatarios_adicionais inválido: " + item);
            }
            String canalRaw = item.substring(0, sep).trim();
            String valor = item.substring(sep + 1).trim();
            if (!StringUtils.hasText(valor)) {
                throw new IllegalArgumentException("destinatarios_adicionais sem valor: " + item);
            }
            CanalNotificacao canal;
            try {
                canal = CanalNotificacao.valueOf(canalRaw.toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Canal inválido em destinatarios_adicionais: " + canalRaw);
            }
            String chave = canal.name() + ":" + valor;
            if (vistos.add(chave)) {
                out.add(new DestinatarioCsv(canal, valor));
            }
        }
        return out;
    }

    static TipoCadencia parseTipoCadencia(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        try {
            return TipoCadencia.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("tipo_cadencia inválido: " + raw);
        }
    }

    static PeriodoCadencia parsePeriodo(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        try {
            return PeriodoCadencia.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("periodo inválido: " + raw);
        }
    }

    static Integer parsePrioridade(String raw) {
        if (!StringUtils.hasText(raw)) {
            return 0;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("prioridade inválida: " + raw);
        }
    }

    static Integer parseIntervaloMinutos(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("intervalo_minutos inválido: " + raw);
        }
    }

    static void validarLinhaAgendamento(
            TipoCadencia tipo,
            Integer intervaloMinutos,
            String horariosFixos,
            PeriodoCadencia periodo,
            LocalTime periodoHorario) {
        try {
            AgendamentoProximaExecucaoCalculo.validarCadencia(
                    tipo, intervaloMinutos, horariosFixos, periodo, periodoHorario);
        } catch (BusinessRuleException e) {
            throw new IllegalArgumentException(e.getMessage());
        }
    }

    static boolean agendamentosEquivalentes(AgendamentoConsultaEntity existente, LinhaAgendamentoCsv linha) {
        return existente.getTipoCadencia() == linha.tipoCadencia()
                && Objects.equals(existente.getIntervaloMinutos(), linha.intervaloMinutos())
                && horariosFixosEquivalentes(existente.getHorariosFixos(), linha.horariosFixos())
                && existente.getPeriodo() == linha.periodo()
                && Objects.equals(existente.getPeriodoHorario(), linha.periodoHorario())
                && Objects.equals(existente.getJanelaInicio(), linha.janelaInicio())
                && Objects.equals(existente.getJanelaFim(), linha.janelaFim())
                && Boolean.TRUE.equals(existente.getApenasDiasUteis()) == linha.apenasDiasUteis()
                && Boolean.TRUE.equals(existente.getConsiderarFeriados()) == linha.considerarFeriados()
                && Objects.equals(
                        existente.getPrioridade() != null ? existente.getPrioridade() : 0, linha.prioridade())
                && motivosEquivalentes(existente.getMotivo(), linha.motivo())
                && validoAteEquivalente(existente.getValidoAte(), linha.validoAte())
                && Boolean.TRUE.equals(existente.getAtivo()) == linha.ativo();
    }

    private static boolean horariosFixosEquivalentes(String a, String b) {
        if (!StringUtils.hasText(a) && !StringUtils.hasText(b)) {
            return true;
        }
        if (!StringUtils.hasText(a) || !StringUtils.hasText(b)) {
            return false;
        }
        String normA = AgendamentoProximaExecucaoCalculo.parseHorariosFixos(a.replace('|', ',')).stream()
                .map(t -> t.format(HORA))
                .collect(Collectors.joining(","));
        String normB = AgendamentoProximaExecucaoCalculo.parseHorariosFixos(b.replace('|', ',')).stream()
                .map(t -> t.format(HORA))
                .collect(Collectors.joining(","));
        return normA.equals(normB);
    }

    private static boolean motivosEquivalentes(String a, String b) {
        String ma = StringUtils.hasText(a) ? a.trim() : "";
        String mb = StringUtils.hasText(b) ? b.trim() : "";
        return ma.equals(mb);
    }

    private static boolean validoAteEquivalente(LocalDateTime a, LocalDateTime b) {
        LocalDate da = a != null ? a.toLocalDate() : null;
        LocalDate db = b != null ? b.toLocalDate() : null;
        return Objects.equals(da, db);
    }

    record DestinatarioCsv(CanalNotificacao canal, String valor) {}

    record LinhaAgendamentoCsv(
            TipoCadencia tipoCadencia,
            Integer intervaloMinutos,
            String horariosFixos,
            PeriodoCadencia periodo,
            LocalTime periodoHorario,
            LocalTime janelaInicio,
            LocalTime janelaFim,
            boolean apenasDiasUteis,
            boolean considerarFeriados,
            int prioridade,
            String motivo,
            LocalDateTime validoAte,
            boolean ativo) {}
}
