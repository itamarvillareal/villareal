package br.com.vilareal.whatsapp.service;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.whatsapp.ScheduledMessageStatus;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.ScheduledWhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.ScheduledWhatsAppMessageRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Agendamento e envio automático de mensagens WhatsApp por template.
 *
 * <p>Seguro para instância única. Para múltiplas instâncias, usar ShedLock ou lock pessimista.
 */
@Service
public class WhatsAppSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppSchedulerService.class);
    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter DATA_HORA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm");
    private static final int MAX_RETRIES = 3;
    private static final String LANGUAGE_PT_BR = "pt_BR";

    private final ScheduledWhatsAppMessageRepository scheduledRepository;
    private final WhatsAppService whatsAppService;
    private final ProcessoRepository processoRepository;
    private final ObjectMapper objectMapper;

    public WhatsAppSchedulerService(
            ScheduledWhatsAppMessageRepository scheduledRepository,
            WhatsAppService whatsAppService,
            ProcessoRepository processoRepository,
            ObjectMapper objectMapper) {
        this.scheduledRepository = scheduledRepository;
        this.whatsAppService = whatsAppService;
        this.processoRepository = processoRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ScheduledWhatsAppMessageEntity agendarMensagem(
            String phoneNumber,
            String templateName,
            List<String> params,
            Instant scheduledAt,
            Long clienteId,
            Long processoId,
            String createdBy,
            String descricao) {
        if (scheduledAt == null || !scheduledAt.isAfter(Instant.now())) {
            throw new IllegalArgumentException("Data de agendamento deve ser no futuro");
        }

        String formattedPhone = WhatsAppService.formatPhoneNumber(phoneNumber);
        String paramsJson = serializeParams(params);

        ScheduledWhatsAppMessageEntity entity = new ScheduledWhatsAppMessageEntity();
        entity.setPhoneNumber(formattedPhone);
        entity.setTemplateName(templateName);
        entity.setTemplateParams(paramsJson);
        entity.setScheduledAt(scheduledAt);
        entity.setStatus(ScheduledMessageStatus.PENDING);
        entity.setClienteId(clienteId);
        entity.setProcessoId(processoId);
        entity.setCreatedBy(createdBy);
        entity.setDescricao(descricao);

        ScheduledWhatsAppMessageEntity saved = scheduledRepository.save(entity);
        log.info(
                "Mensagem agendada: template={}, para={}, em={}, id={}",
                templateName,
                maskPhoneNumber(formattedPhone),
                scheduledAt,
                saved.getId());
        return saved;
    }

    @Transactional
    public void agendarLembreteAudiencia(
            Long clienteId,
            Long processoId,
            String phoneNumber,
            String nomeCliente,
            String numeroProcesso,
            Instant dataAudiencia) {
        if (processoId != null
                && !scheduledRepository
                        .findByProcessoIdAndStatusAndTemplateName(
                                processoId, ScheduledMessageStatus.PENDING, "lembrete_audiencia")
                        .isEmpty()) {
            log.info("Lembrete de audiência já agendado para processo {}", processoId);
            return;
        }

        Instant scheduledAt = calcularHorarioEnvio(dataAudiencia, 24, 2);
        List<String> params =
                List.of(nomeCliente, numeroProcesso, formatarDataHoraBR(dataAudiencia));

        agendarMensagem(
                phoneNumber,
                "lembrete_audiencia",
                params,
                scheduledAt,
                clienteId,
                processoId,
                "sistema",
                "Lembrete de audiência - " + numeroProcesso);
    }

    @Transactional
    public void agendarLembretePrazo(
            Long clienteId,
            Long processoId,
            String phoneNumber,
            String nomeCliente,
            String descricaoPrazo,
            Instant dataPrazo) {
        if (processoId != null
                && !scheduledRepository
                        .findByProcessoIdAndStatusAndTemplateName(
                                processoId, ScheduledMessageStatus.PENDING, "atualizacao_processo")
                        .isEmpty()) {
            log.info("Lembrete de prazo já agendado para processo {}", processoId);
            return;
        }

        String numeroProcesso = resolverNumeroProcesso(processoId);
        Instant scheduledAt = calcularHorarioEnvio(dataPrazo, 72, 24);
        List<String> params = List.of(nomeCliente, numeroProcesso, descricaoPrazo);

        agendarMensagem(
                phoneNumber,
                "atualizacao_processo",
                params,
                scheduledAt,
                clienteId,
                processoId,
                "sistema",
                "Lembrete de prazo - " + numeroProcesso);
    }

    @Transactional
    public void cancelarAgendamento(Long id) {
        ScheduledWhatsAppMessageEntity entity = scheduledRepository
                .findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Agendamento não encontrado: " + id));

        if (entity.getStatus() != ScheduledMessageStatus.PENDING) {
            throw new IllegalStateException("Só é possível cancelar agendamentos pendentes");
        }

        entity.setStatus(ScheduledMessageStatus.CANCELLED);
        scheduledRepository.save(entity);
        log.info("Agendamento {} cancelado", id);
    }

    @Scheduled(fixedRate = 60_000)
    public void processarAgendamentos() {
        List<ScheduledWhatsAppMessageEntity> pendentes = scheduledRepository.findByStatusAndScheduledAtBeforeOrderByScheduledAtAsc(
                ScheduledMessageStatus.PENDING, Instant.now());

        if (pendentes.isEmpty()) {
            return;
        }

        log.info("Processando {} agendamento(s) pendente(s)", pendentes.size());

        for (ScheduledWhatsAppMessageEntity agendamento : pendentes) {
            processarAgendamento(agendamento);
        }
    }

    private void processarAgendamento(ScheduledWhatsAppMessageEntity agendamento) {
        try {
            List<String> params = deserializeParams(agendamento.getTemplateParams());
            whatsAppService.sendTemplateMessage(
                    agendamento.getPhoneNumber(),
                    agendamento.getTemplateName(),
                    LANGUAGE_PT_BR,
                    params);

            agendamento.setStatus(ScheduledMessageStatus.SENT);
            agendamento.setSentAt(Instant.now());
            agendamento.setErrorMessage(null);
            scheduledRepository.save(agendamento);
            log.info("Agendamento {} enviado com sucesso", agendamento.getId());
        } catch (Exception e) {
            agendamento.setRetryCount(agendamento.getRetryCount() + 1);
            String erro = truncate(e.getMessage(), 500);

            if (agendamento.getRetryCount() >= MAX_RETRIES) {
                agendamento.setStatus(ScheduledMessageStatus.FAILED);
                agendamento.setErrorMessage(erro);
                scheduledRepository.save(agendamento);
                log.error(
                        "Agendamento {} falhou definitivamente após {} tentativas: {}",
                        agendamento.getId(),
                        MAX_RETRIES,
                        erro);
            } else {
                agendamento.setErrorMessage(erro);
                scheduledRepository.save(agendamento);
                log.warn(
                        "Agendamento {} falhou (tentativa {}/{}): {}",
                        agendamento.getId(),
                        agendamento.getRetryCount(),
                        MAX_RETRIES,
                        erro);
            }
        }
    }

    private String serializeParams(List<String> params) {
        try {
            return objectMapper.writeValueAsString(params != null ? params : List.of());
        } catch (Exception e) {
            throw new IllegalArgumentException("Falha ao serializar parâmetros do template", e);
        }
    }

    private List<String> deserializeParams(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            throw new IllegalArgumentException("Falha ao deserializar parâmetros do template", e);
        }
    }

    private static Instant calcularHorarioEnvio(Instant evento, long horasPrimarias, long horasFallback) {
        Instant now = Instant.now();
        Instant primario = evento.minus(horasPrimarias, ChronoUnit.HOURS);
        if (primario.isAfter(now)) {
            return primario;
        }
        Instant fallback = evento.minus(horasFallback, ChronoUnit.HOURS);
        if (fallback.isAfter(now)) {
            return fallback;
        }
        return now.plus(5, ChronoUnit.MINUTES);
    }

    private String resolverNumeroProcesso(Long processoId) {
        if (processoId == null) {
            return "—";
        }
        return processoRepository
                .findById(processoId)
                .map(this::formatNumeroProcesso)
                .orElse("Processo " + processoId);
    }

    private String formatNumeroProcesso(ProcessoEntity processo) {
        if (StringUtils.hasText(processo.getNumeroCnj())) {
            return processo.getNumeroCnj();
        }
        if (processo.getNumeroInterno() != null) {
            return "Nº interno " + processo.getNumeroInterno();
        }
        return "Processo " + processo.getId();
    }

    private static String formatarDataHoraBR(Instant instant) {
        return DATA_HORA_BR.withZone(ZONE_BRASILIA).format(instant);
    }

    private static String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private static String maskPhoneNumber(String phone) {
        if (!StringUtils.hasText(phone) || phone.length() < 8) {
            return "****";
        }
        return phone.substring(0, 5) + "****" + phone.substring(phone.length() - 4);
    }
}
