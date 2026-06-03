package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteWhatsAppEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.whatsapp.ScheduledMessageStatus;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.ScheduledWhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.ScheduledWhatsAppMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Job diário que varre audiências em {@code processo.audiencia_data} (fonte canônica; a agenda do front
 * espelha esses dados) e agenda lembretes WhatsApp via {@link WhatsAppSchedulerService}.
 */
@Service
public class AudienciaReminderJob {

    private static final Logger log = LoggerFactory.getLogger(AudienciaReminderJob.class);
    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter DATA_HORA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm");
    private static final LocalTime HORA_PADRAO = LocalTime.of(9, 0);
    private static final String TEMPLATE_LEMBRETE = "lembrete_audiencia";
    private static final String DESCRICAO_REFORCO_PREFIX = "Reforço véspera — ";

    private final WhatsAppConfig whatsAppConfig;
    private final ProcessoRepository processoRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final ClienteWhatsAppRepository clienteWhatsAppRepository;
    private final ScheduledWhatsAppMessageRepository scheduledRepository;
    private final WhatsAppSchedulerService whatsAppSchedulerService;
    private final JobRunTracker jobRunTracker;

    public AudienciaReminderJob(
            WhatsAppConfig whatsAppConfig,
            ProcessoRepository processoRepository,
            PessoaContatoRepository pessoaContatoRepository,
            ClienteWhatsAppRepository clienteWhatsAppRepository,
            ScheduledWhatsAppMessageRepository scheduledRepository,
            WhatsAppSchedulerService whatsAppSchedulerService,
            JobRunTracker jobRunTracker) {
        this.whatsAppConfig = whatsAppConfig;
        this.processoRepository = processoRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.clienteWhatsAppRepository = clienteWhatsAppRepository;
        this.scheduledRepository = scheduledRepository;
        this.whatsAppSchedulerService = whatsAppSchedulerService;
        this.jobRunTracker = jobRunTracker;
    }

    public record ExecucaoStats(int agendados, int pulados) {}

    @Scheduled(cron = "${whatsapp.reminder.cron:0 0 7 * * MON-FRI}", zone = "America/Sao_Paulo")
    public void verificarAudienciasProximas() {
        try {
            jobRunTracker.runTrackedJobVoid(JobNames.WHATSAPP_LEMBRETE_AUDIENCIA, ctx -> {
                if (!whatsAppConfig.isReminderEnabled()) {
                    log.debug("Job de lembretes de audiência desabilitado via configuração");
                    ctx.putMetadata("skipped", "disabled");
                    return;
                }
                ExecucaoStats stats = executarVerificacaoAudienciasProximas();
                ctx.setItemsProcessed(stats.agendados());
                ctx.setItemsFailed(stats.pulados());
            });
        } catch (Exception e) {
            log.error("Erro fatal no job de lembretes de audiência: {}", e.getMessage(), e);
        }
    }

    @Scheduled(cron = "${whatsapp.reminder.reforco-cron:0 0 18 * * MON-FRI}", zone = "America/Sao_Paulo")
    public void reforcoVesperaAudiencia() {
        try {
            jobRunTracker.runTrackedJobVoid(JobNames.WHATSAPP_REFORCO_AUDIENCIA, ctx -> {
                if (!whatsAppConfig.isReminderEnabled() || !whatsAppConfig.isReminderReforcoEnabled()) {
                    log.debug("Job de reforço véspera desabilitado via configuração");
                    ctx.putMetadata("skipped", "disabled");
                    return;
                }
                ExecucaoStats stats = executarReforcoVespera();
                ctx.setItemsProcessed(stats.agendados());
                ctx.setItemsFailed(stats.pulados());
            });
        } catch (Exception e) {
            log.error("Erro fatal no job de reforço véspera de audiência: {}", e.getMessage(), e);
        }
    }

    @Transactional
    public ExecucaoStats executarVerificacaoAudienciasProximas() {
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
        int dias = Math.max(1, whatsAppConfig.getReminderDaysAhead());
        LocalDate limite = hoje.plusDays(dias);

        List<ProcessoEntity> audiencias = processoRepository.findAudienciasEntre(hoje, limite);
        log.info("Verificando audiências entre {} e {}. Encontradas: {}", hoje, limite, audiencias.size());

        int agendados = 0;
        int pulados = 0;

        for (ProcessoEntity processo : audiencias) {
            try {
                ResultadoItem resultado = processarAudienciaParaLembrete(processo);
                if (resultado == ResultadoItem.AGENDADO) {
                    agendados++;
                } else {
                    pulados++;
                }
            } catch (Exception e) {
                pulados++;
                log.error("Erro ao processar audiência do processo {}: {}", processo.getId(), e.getMessage(), e);
            }
        }

        log.info(
                "Job de lembretes concluído. {} lembretes criados, {} pulados (duplicatas/sem vínculo/erro)",
                agendados,
                pulados);
        return new ExecucaoStats(agendados, pulados);
    }

    @Transactional
    public ExecucaoStats executarReforcoVespera() {
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
        LocalDate diaAlvo = proximoDiaUtilComAudiencia(hoje);

        List<ProcessoEntity> audiencias = processoRepository.findAudienciasEntre(diaAlvo, diaAlvo);
        log.info("Reforço véspera: audiências em {}. Encontradas: {}", diaAlvo, audiencias.size());

        int agendados = 0;
        int pulados = 0;

        for (ProcessoEntity processo : audiencias) {
            try {
                if (processarReforcoVespera(processo)) {
                    agendados++;
                } else {
                    pulados++;
                }
            } catch (Exception e) {
                pulados++;
                log.error(
                        "Erro ao processar reforço véspera do processo {}: {}",
                        processo.getId(),
                        e.getMessage(),
                        e);
            }
        }

        log.info("Job reforço véspera concluído. {} agendados, {} pulados", agendados, pulados);
        return new ExecucaoStats(agendados, pulados);
    }

    private ResultadoItem processarAudienciaParaLembrete(ProcessoEntity processo) {
        Instant dataAudiencia = montarInstantAudiencia(processo);
        if (dataAudiencia == null) {
            log.warn(
                    "Audiência do processo {} em {} sem data/hora válida. Pulando.",
                    processo.getId(),
                    processo.getAudienciaData());
            return ResultadoItem.PULADO;
        }

        if (!dataAudiencia.isAfter(Instant.now())) {
            log.debug("Audiência do processo {} já passou ({}). Pulando.", processo.getId(), dataAudiencia);
            return ResultadoItem.PULADO;
        }

        ClienteEntity cliente = processo.getCliente();
        if (cliente == null) {
            log.warn(
                    "Audiência do processo {} em {} sem cliente vinculado. Pulando.",
                    processo.getId(),
                    formatarDataHoraBR(dataAudiencia));
            return ResultadoItem.PULADO;
        }

        String telefone = resolverTelefoneCliente(cliente);
        if (!StringUtils.hasText(telefone)) {
            log.warn(
                    "Audiência do processo {} em {} sem telefone do cliente. Pulando.",
                    processo.getId(),
                    formatarDataHoraBR(dataAudiencia));
            return ResultadoItem.PULADO;
        }

        Long processoId = processo.getId();
        if (!scheduledRepository
                .findByProcessoIdAndStatusAndTemplateName(processoId, ScheduledMessageStatus.PENDING, TEMPLATE_LEMBRETE)
                .isEmpty()) {
            log.debug(
                    "Lembrete já agendado para processo {}. Pulando.",
                    formatNumeroProcesso(processo));
            return ResultadoItem.PULADO;
        }

        int pendentesAntes = scheduledRepository
                .findByProcessoIdAndStatusAndTemplateName(
                        processoId, ScheduledMessageStatus.PENDING, TEMPLATE_LEMBRETE)
                .size();

        String nomeCliente = resolverNomeCliente(cliente, processo);
        String numeroProcesso = formatNumeroProcesso(processo);

        whatsAppSchedulerService.agendarLembreteAudiencia(
                cliente.getId(),
                processoId,
                telefone,
                nomeCliente,
                numeroProcesso,
                dataAudiencia);

        int pendentesDepois = scheduledRepository
                .findByProcessoIdAndStatusAndTemplateName(
                        processoId, ScheduledMessageStatus.PENDING, TEMPLATE_LEMBRETE)
                .size();

        if (pendentesDepois > pendentesAntes) {
            log.info(
                    "Lembrete agendado para {} — audiência em {} — processo {}",
                    nomeCliente,
                    formatarDataHoraBR(dataAudiencia),
                    numeroProcesso);
            return ResultadoItem.AGENDADO;
        }

        log.debug("Lembrete não criado (duplicata interna) para processo {}. Pulando.", numeroProcesso);
        return ResultadoItem.PULADO;
    }

    private boolean processarReforcoVespera(ProcessoEntity processo) {
        Instant dataAudiencia = montarInstantAudiencia(processo);
        if (dataAudiencia == null || !dataAudiencia.isAfter(Instant.now())) {
            return false;
        }

        Long processoId = processo.getId();
        List<ScheduledWhatsAppMessageEntity> enviados = scheduledRepository.findByProcessoIdAndStatusAndTemplateName(
                processoId, ScheduledMessageStatus.SENT, TEMPLATE_LEMBRETE);
        if (enviados.isEmpty()) {
            log.debug("Reforço véspera: processo {} sem lembrete 24h enviado. Pulando.", processoId);
            return false;
        }

        boolean reforcoPendente = scheduledRepository
                .findByProcessoIdAndStatusAndTemplateName(
                        processoId, ScheduledMessageStatus.PENDING, TEMPLATE_LEMBRETE)
                .stream()
                .anyMatch(e -> e.getDescricao() != null && e.getDescricao().startsWith(DESCRICAO_REFORCO_PREFIX));
        if (reforcoPendente) {
            log.debug("Reforço véspera já pendente para processo {}. Pulando.", processoId);
            return false;
        }

        Instant scheduledAt = dataAudiencia.minus(2, ChronoUnit.HOURS);
        if (!scheduledAt.isAfter(Instant.now())) {
            log.debug("Reforço véspera: horário 2h antes já passou para processo {}. Pulando.", processoId);
            return false;
        }

        ClienteEntity cliente = processo.getCliente();
        if (cliente == null) {
            log.warn("Reforço véspera: processo {} sem cliente. Pulando.", processoId);
            return false;
        }

        String telefone = resolverTelefoneCliente(cliente);
        if (!StringUtils.hasText(telefone)) {
            log.warn("Reforço véspera: processo {} sem telefone. Pulando.", processoId);
            return false;
        }

        String nomeCliente = resolverNomeCliente(cliente, processo);
        String numeroProcesso = formatNumeroProcesso(processo);
        List<String> params = List.of(nomeCliente, numeroProcesso, formatarDataHoraBR(dataAudiencia));

        whatsAppSchedulerService.agendarMensagem(
                telefone,
                TEMPLATE_LEMBRETE,
                params,
                scheduledAt,
                cliente.getId(),
                processoId,
                "sistema",
                DESCRICAO_REFORCO_PREFIX + numeroProcesso);

        log.info(
                "Reforço véspera agendado para {} — audiência em {} — envio em {}",
                nomeCliente,
                formatarDataHoraBR(dataAudiencia),
                formatarDataHoraBR(scheduledAt));
        return true;
    }

    private static LocalDate proximoDiaUtilComAudiencia(LocalDate hoje) {
        if (hoje.getDayOfWeek() == DayOfWeek.FRIDAY) {
            return hoje.plusDays(3);
        }
        if (hoje.getDayOfWeek() == DayOfWeek.SATURDAY) {
            return hoje.plusDays(2);
        }
        if (hoje.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return hoje.plusDays(1);
        }
        return hoje.plusDays(1);
    }

    private Instant montarInstantAudiencia(ProcessoEntity processo) {
        LocalDate data = processo.getAudienciaData();
        if (data == null) {
            return null;
        }
        LocalTime hora = parseHora(processo.getAudienciaHora());
        ZonedDateTime zdt = ZonedDateTime.of(data, hora, ZONE_BRASILIA);
        return zdt.toInstant();
    }

    private static LocalTime parseHora(String horaRaw) {
        if (!StringUtils.hasText(horaRaw)) {
            return HORA_PADRAO;
        }
        String t = horaRaw.trim();
        try {
            if (t.length() == 5) {
                return LocalTime.parse(t, DateTimeFormatter.ofPattern("HH:mm"));
            }
            if (t.length() >= 8) {
                return LocalTime.parse(t.substring(0, 8), DateTimeFormatter.ofPattern("HH:mm:ss"));
            }
        } catch (Exception ignored) {
            // fallback abaixo
        }
        return HORA_PADRAO;
    }

    private String resolverTelefoneCliente(ClienteEntity cliente) {
        List<ClienteWhatsAppEntity> whatsappCadastro =
                clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(cliente.getId());
        for (ClienteWhatsAppEntity w : whatsappCadastro) {
            if (StringUtils.hasText(w.getNumero())) {
                return w.getNumero().trim();
            }
        }

        PessoaEntity pessoa = cliente.getPessoa();
        if (pessoa == null) {
            return null;
        }

        List<PessoaContatoEntity> contatos = pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoa.getId());
        for (PessoaContatoEntity c : contatos) {
            if (c.getTipo() != null
                    && "telefone".equalsIgnoreCase(c.getTipo().trim())
                    && StringUtils.hasText(c.getValor())) {
                return c.getValor().trim();
            }
        }

        if (StringUtils.hasText(pessoa.getTelefone())) {
            return pessoa.getTelefone().trim();
        }
        return null;
    }

    private static String resolverNomeCliente(ClienteEntity cliente, ProcessoEntity processo) {
        PessoaEntity pessoaCliente = cliente.getPessoa();
        if (pessoaCliente != null && StringUtils.hasText(pessoaCliente.getNome())) {
            return pessoaCliente.getNome().trim();
        }
        PessoaEntity titular = processo.getPessoa();
        if (titular != null && StringUtils.hasText(titular.getNome())) {
            return titular.getNome().trim();
        }
        return "Cliente";
    }

    private static String formatNumeroProcesso(ProcessoEntity processo) {
        if (StringUtils.hasText(processo.getNumeroCnj())) {
            return processo.getNumeroCnj().trim();
        }
        if (processo.getNumeroInterno() != null) {
            return "Nº interno " + processo.getNumeroInterno();
        }
        return "Processo " + processo.getId();
    }

    private static String formatarDataHoraBR(Instant instant) {
        return DATA_HORA_BR.withZone(ZONE_BRASILIA).format(instant);
    }

    private enum ResultadoItem {
        AGENDADO,
        PULADO
    }
}
