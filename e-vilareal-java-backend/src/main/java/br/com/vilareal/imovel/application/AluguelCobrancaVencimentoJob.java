package br.com.vilareal.imovel.application;

import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Agenda cobrança WhatsApp no vencimento para contratos com opt-in ({@code agendar_cobranca_whatsapp}).
 */
@Component
public class AluguelCobrancaVencimentoJob {

    public static final String JOB_NAME = "aluguel_cobranca_vencimento";

    private static final Logger log = LoggerFactory.getLogger(AluguelCobrancaVencimentoJob.class);

    private final AluguelCobrancaService aluguelCobrancaService;
    private final JobRunTracker jobRunTracker;

    public AluguelCobrancaVencimentoJob(AluguelCobrancaService aluguelCobrancaService, JobRunTracker jobRunTracker) {
        this.aluguelCobrancaService = aluguelCobrancaService;
        this.jobRunTracker = jobRunTracker;
    }

    /** Diário às 07:30 BRT — antes do horário padrão de envio (09:00). */
    @Scheduled(cron = "0 30 7 * * *", zone = "America/Sao_Paulo")
    public void executar() {
        jobRunTracker.runTrackedJobVoid(JOB_NAME, ctx -> {
            int n = aluguelCobrancaService.agendarCobrancasVencimentoOptIn();
            ctx.setItemsProcessed(n);
            log.debug("[aluguel-cobranca-vencimento] agendados={}", n);
        });
    }
}
