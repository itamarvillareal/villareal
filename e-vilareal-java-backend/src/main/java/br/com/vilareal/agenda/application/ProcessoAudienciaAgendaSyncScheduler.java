package br.com.vilareal.agenda.application;

import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Espelha periodicamente {@code processo.audiencia_*} na agenda — garante que compromissos não fiquem
 * desatualizados mesmo sem ação manual no front.
 */
@Component
public class ProcessoAudienciaAgendaSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(ProcessoAudienciaAgendaSyncScheduler.class);

    private final ProcessoAudienciaAgendaSyncService syncService;
    private final JobRunTracker jobRunTracker;
    private final boolean ativo;

    public ProcessoAudienciaAgendaSyncScheduler(
            ProcessoAudienciaAgendaSyncService syncService,
            JobRunTracker jobRunTracker,
            @Value("${vilareal.agenda.audiencia.sync.scheduled.enabled:true}") boolean ativo) {
        this.syncService = syncService;
        this.jobRunTracker = jobRunTracker;
        this.ativo = ativo;
    }

    /** 06:00, 12:00 e 18:00 (Brasília) — 3× ao dia. */
    @Scheduled(
            cron = "${vilareal.agenda.audiencia.sync.cron:0 0 6,12,18 * * ?}",
            zone = "${vilareal.agenda.audiencia.sync.zone:America/Sao_Paulo}")
    @SchedulerLock(
            name = "processo-audiencia-agenda-sync",
            lockAtMostFor = "PT45M",
            lockAtLeastFor = "PT1M")
    public void tick() {
        if (!ativo) {
            return;
        }
        try {
            jobRunTracker.runTrackedJobVoid(JobNames.AGENDA_AUDIENCIA_ESPELHAMENTO, ctx -> {
                ProcessoAudienciaAgendaSyncService.BackfillResult r =
                        syncService.backfillTodosAtivosComAudiencia();
                ctx.setItemsProcessed(r.processosProcessados());
                ctx.setItemsFailed(r.falhas());
                ctx.putMetadata("colaboradoresSincronizados", r.colaboradoresSincronizados());
                ctx.putMetadata("eventosRemovidos", r.eventosRemovidos());
                if (r.processosProcessados() > 0 || r.eventosRemovidos() > 0) {
                    log.info(
                            "Espelhamento audiências → agenda: processos={} colaboradores={} removidos={} falhas={}",
                            r.processosProcessados(),
                            r.colaboradoresSincronizados(),
                            r.eventosRemovidos(),
                            r.falhas());
                } else {
                    log.debug("Espelhamento audiências → agenda: nada a atualizar.");
                }
            });
        } catch (Exception e) {
            log.warn("Espelhamento audiências → agenda: falha no job: {}", e.getMessage());
        }
    }
}
