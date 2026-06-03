package br.com.vilareal.iptu.job;

import br.com.vilareal.iptu.application.IptuApplicationService;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * Daily job: sets IPTU parcels from {@code PENDENTE} to {@code ATRASADO} when due date passed
 * (same pattern as {@link br.com.vilareal.pagamento.job.PagamentoRotinaDiariaJob}).
 */
@Component
public class IptuRotinaDiariaJob {

    private static final Logger log = LoggerFactory.getLogger(IptuRotinaDiariaJob.class);

    private final IptuApplicationService iptuApplicationService;
    private final JobRunTracker jobRunTracker;

    public IptuRotinaDiariaJob(IptuApplicationService iptuApplicationService, JobRunTracker jobRunTracker) {
        this.iptuApplicationService = iptuApplicationService;
        this.jobRunTracker = jobRunTracker;
    }

    @Scheduled(cron = "0 5 6 * * ?", zone = "America/Sao_Paulo")
    public void rodar() {
        try {
            jobRunTracker.runTrackedJobVoid(JobNames.IPTU_ROTINA_DIARIA, ctx -> {
                int n = iptuApplicationService.atualizarParcelasAtrasadas(LocalDate.now());
                ctx.setItemsProcessed(n);
                if (n > 0) {
                    log.info("[iptu] Daily job marked {} parcel(s) as ATRASADO.", n);
                }
            });
        } catch (Exception e) {
            log.warn("[iptu] Daily job failed: {}", e.getMessage());
        }
    }
}
