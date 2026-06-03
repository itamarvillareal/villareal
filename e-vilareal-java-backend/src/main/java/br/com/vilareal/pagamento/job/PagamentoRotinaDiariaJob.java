package br.com.vilareal.pagamento.job;

import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.pagamento.application.PagamentoApplicationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class PagamentoRotinaDiariaJob {

    private static final Logger log = LoggerFactory.getLogger(PagamentoRotinaDiariaJob.class);

    private final PagamentoApplicationService pagamentoApplicationService;
    private final JobRunTracker jobRunTracker;

    public PagamentoRotinaDiariaJob(
            PagamentoApplicationService pagamentoApplicationService, JobRunTracker jobRunTracker) {
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.jobRunTracker = jobRunTracker;
    }

    /** 06:00 America/Sao_Paulo — atualiza PENDENTE→VENCIDO, AGENDADO→CONFERENCIA_PENDENTE após calendário. */
    @Scheduled(cron = "0 0 6 * * ?", zone = "America/Sao_Paulo")
    public void rodar() {
        try {
            jobRunTracker.runTrackedJobVoid(JobNames.PAGAMENTO_ROTINA_DIARIA, ctx -> {
                int n = pagamentoApplicationService.aplicarTransicoesAutomaticasPorData();
                ctx.setItemsProcessed(n);
                if (n > 0) {
                    log.info("[pagamentos] Rotina diária alterou {} registro(s).", n);
                }
            });
        } catch (Exception e) {
            log.warn("[pagamentos] Falha na rotina diária: {}", e.getMessage());
        }
    }
}
