package br.com.vilareal.iptu.job;

import br.com.vilareal.iptu.application.IptuApplicationService;
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

    public IptuRotinaDiariaJob(IptuApplicationService iptuApplicationService) {
        this.iptuApplicationService = iptuApplicationService;
    }

    @Scheduled(cron = "0 5 6 * * ?", zone = "America/Sao_Paulo")
    public void rodar() {
        try {
            int n = iptuApplicationService.atualizarParcelasAtrasadas(LocalDate.now());
            if (n > 0) {
                log.info("[iptu] Daily job marked {} parcel(s) as ATRASADO.", n);
            }
        } catch (Exception e) {
            log.warn("[iptu] Daily job failed: {}", e.getMessage());
        }
    }
}
