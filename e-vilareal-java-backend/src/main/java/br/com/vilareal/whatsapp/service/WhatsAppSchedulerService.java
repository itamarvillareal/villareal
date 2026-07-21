package br.com.vilareal.whatsapp.service;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.whatsapp.ScheduledMessageStatus;
import br.com.vilareal.whatsapp.dto.RecorrenciaAgendamentoRequest;
import br.com.vilareal.whatsapp.dto.RecorrenciaMensalRequest;
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
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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
    private final JobRunTracker jobRunTracker;

    public WhatsAppSchedulerService(
            ScheduledWhatsAppMessageRepository scheduledRepository,
            WhatsAppService whatsAppService,
            ProcessoRepository processoRepository,
            ObjectMapper objectMapper,
            JobRunTracker jobRunTracker) {
        this.scheduledRepository = scheduledRepository;
        this.whatsAppService = whatsAppService;
        this.processoRepository = processoRepository;
        this.objectMapper = objectMapper;
        this.jobRunTracker = jobRunTracker;
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
        return agendarMensagem(
                phoneNumber, templateName, params, scheduledAt, clienteId, processoId, null, createdBy, descricao);
    }

    @Transactional
    public ScheduledWhatsAppMessageEntity agendarMensagem(
            String phoneNumber,
            String templateName,
            List<String> params,
            Instant scheduledAt,
            Long clienteId,
            Long processoId,
            Long pagamentoId,
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
        entity.setPagamentoId(pagamentoId);
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

    public record AgendarLoteResult(int criados, int pulados, int totalSolicitado, List<Long> ids, List<Instant> scheduledAt) {}

    /**
     * Cria vários agendamentos idênticos (mesmo destinatário/template/params), um por data.
     * Duplicatas pendentes (mesmo telefone, template e horário) são ignoradas.
     */
    @Transactional
    public AgendarLoteResult agendarMensagensEmLote(
            String phoneNumber,
            String templateName,
            List<String> params,
            List<Instant> scheduledAts,
            Long clienteId,
            Long processoId,
            String createdBy,
            String descricao) {
        if (scheduledAts == null || scheduledAts.isEmpty()) {
            throw new IllegalArgumentException("Informe pelo menos uma data de agendamento");
        }

        String formattedPhone = WhatsAppService.formatPhoneNumber(phoneNumber);
        Instant now = Instant.now();
        Set<Instant> datasUnicas = new LinkedHashSet<>(scheduledAts);

        int criados = 0;
        int pulados = 0;
        List<Long> ids = new ArrayList<>();
        List<Instant> criadosAt = new ArrayList<>();

        for (Instant scheduledAt : datasUnicas) {
            if (scheduledAt == null || !scheduledAt.isAfter(now)) {
                pulados++;
                continue;
            }
            if (scheduledRepository.existsByPhoneNumberAndTemplateNameAndScheduledAtAndStatus(
                    formattedPhone, templateName, scheduledAt, ScheduledMessageStatus.PENDING)) {
                pulados++;
                continue;
            }
            ScheduledWhatsAppMessageEntity saved = agendarMensagem(
                    formattedPhone,
                    templateName,
                    params,
                    scheduledAt,
                    clienteId,
                    processoId,
                    null,
                    createdBy,
                    descricao);
            criados++;
            ids.add(saved.getId());
            criadosAt.add(saved.getScheduledAt());
        }

        if (criados == 0) {
            throw new IllegalArgumentException(
                    "Nenhum agendamento criado (todas as datas são passadas ou já existem pendentes)");
        }

        return new AgendarLoteResult(criados, pulados, datasUnicas.size(), ids, criadosAt);
    }

    /** Resolve lista de datas a partir de avulsas ou recorrência. */
    public List<Instant> resolverDatasAgendamentoLote(
            List<Instant> scheduledAtList,
            RecorrenciaAgendamentoRequest recorrencia,
            RecorrenciaMensalRequest recorrenciaMensal) {
        if (recorrencia != null) {
            return WhatsAppScheduleRecurrenceSupport.resolver(recorrencia);
        }
        if (recorrenciaMensal != null) {
            return WhatsAppScheduleRecurrenceSupport.resolverLegadoMensal(recorrenciaMensal);
        }
        if (scheduledAtList == null || scheduledAtList.isEmpty()) {
            throw new IllegalArgumentException("Informe datas avulsas ou uma recorrência");
        }
        return WhatsAppScheduleRecurrenceSupport.limitar(List.copyOf(scheduledAtList));
    }

    /**
     * Enfileira envio imediato de {@code atualizacao_processo} (fila com retry/histórico do scheduler).
     */
    @Transactional
    public void enfileirarAtualizacaoProcesso(
            String phoneNumber,
            List<String> templateParams,
            Long clienteId,
            Long processoId,
            String descricao) {
        Instant scheduledAt = Instant.now().plusSeconds(2);
        agendarMensagem(
                phoneNumber,
                "atualizacao_processo",
                templateParams,
                scheduledAt,
                clienteId,
                processoId,
                "monitor-movimentacao",
                descricao != null ? descricao : "Atualização de processo");
    }

    @Transactional
    public boolean agendarLembreteAudiencia(
            Long clienteId,
            Long processoId,
            String phoneNumber,
            String nomeDestinatario,
            String numeroProcesso,
            String parteCliente,
            String parteAutora,
            Instant dataAudiencia,
            String linkReuniao) {
        String formattedPhone = WhatsAppService.formatPhoneNumber(phoneNumber);
        if (processoId != null
                && lembreteAudienciaPendenteParaTelefone(processoId, formattedPhone, false)) {
            log.debug("Lembrete de audiência já agendado para processo {} e telefone {}", processoId, maskPhoneNumber(formattedPhone));
            return false;
        }

        Instant scheduledAt = calcularHorarioEnvio(dataAudiencia, 24, 2);
        List<String> params = LembreteAudienciaTemplateParams.montar(
                nomeDestinatario, numeroProcesso, parteCliente, parteAutora, dataAudiencia, linkReuniao);
        String templateName = LembreteAudienciaTemplateParams.resolverNomeTemplate(linkReuniao);

        agendarMensagem(
                formattedPhone,
                templateName,
                params,
                scheduledAt,
                clienteId,
                processoId,
                "sistema",
                "Lembrete de audiência - " + numeroProcesso);
        return true;
    }

    /** @return {@code true} se criou agendamento; {@code false} se já existia pendente para o mesmo telefone. */
    @Transactional
    public boolean agendarReforcoAudiencia(
            Long clienteId,
            Long processoId,
            String phoneNumber,
            List<String> params,
            Instant scheduledAt,
            String numeroProcesso,
            String templateName) {
        String formattedPhone = WhatsAppService.formatPhoneNumber(phoneNumber);
        String descricao = "Reforço véspera — " + numeroProcesso;
        if (processoId != null
                && lembreteAudienciaPendenteParaTelefone(processoId, formattedPhone, true)) {
            log.debug(
                    "Reforço véspera já agendado para processo {} e telefone {}",
                    processoId,
                    maskPhoneNumber(formattedPhone));
            return false;
        }

        agendarMensagem(
                formattedPhone,
                templateName != null ? templateName : LembreteAudienciaTemplateParams.TEMPLATE_PADRAO,
                params,
                scheduledAt,
                clienteId,
                processoId,
                "sistema",
                descricao);
        return true;
    }

    private boolean lembreteAudienciaPendenteParaTelefone(
            Long processoId, String formattedPhone, boolean reforco) {
        for (String templateName : LembreteAudienciaTemplateParams.nomesTemplates()) {
            boolean pendente = scheduledRepository
                    .findByProcessoIdAndStatusAndTemplateName(
                            processoId, ScheduledMessageStatus.PENDING, templateName)
                    .stream()
                    .anyMatch(e -> formattedPhone.equals(e.getPhoneNumber())
                            && reforco == (e.getDescricao() != null
                                    && e.getDescricao().startsWith("Reforço véspera — ")));
            if (pendente) {
                return true;
            }
        }
        return false;
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
        jobRunTracker.runTrackedJobVoid(JobNames.WHATSAPP_AGENDAMENTOS, ctx -> {
            List<ScheduledWhatsAppMessageEntity> pendentes =
                    scheduledRepository.findByStatusAndScheduledAtBeforeOrderByScheduledAtAsc(
                            ScheduledMessageStatus.PENDING, Instant.now());

            if (pendentes.isEmpty()) {
                ctx.putMetadata("skipped", "nenhum_pendente");
                return;
            }

            log.info("Processando {} agendamento(s) pendente(s)", pendentes.size());
            int enviados = 0;
            int falhas = 0;
            for (int i = 0; i < pendentes.size(); i++) {
                ctx.heartbeatACadaItens(i + 1, 3);
                ScheduledWhatsAppMessageEntity antes = pendentes.get(i);
                processarAgendamento(antes);
                ScheduledWhatsAppMessageEntity depois =
                        scheduledRepository.findById(antes.getId()).orElse(antes);
                if (depois.getStatus() == ScheduledMessageStatus.SENT) {
                    enviados++;
                } else if (depois.getStatus() == ScheduledMessageStatus.FAILED) {
                    falhas++;
                }
            }
            ctx.setItemsProcessed(enviados);
            ctx.setItemsFailed(falhas);
            ctx.putMetadata("pendentesNoCiclo", pendentes.size());
        });
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
