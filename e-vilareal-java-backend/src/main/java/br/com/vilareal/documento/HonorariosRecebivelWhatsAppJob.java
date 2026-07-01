package br.com.vilareal.documento;

import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Dispara lembretes WhatsApp de honorários no horário configurado (Brasília). */
@Component
public class HonorariosRecebivelWhatsAppJob {

    private final HonorariosRecebivelWhatsAppService honorariosRecebivelWhatsAppService;
    private final JobRunTracker jobRunTracker;

    public HonorariosRecebivelWhatsAppJob(
            HonorariosRecebivelWhatsAppService honorariosRecebivelWhatsAppService,
            JobRunTracker jobRunTracker) {
        this.honorariosRecebivelWhatsAppService = honorariosRecebivelWhatsAppService;
        this.jobRunTracker = jobRunTracker;
    }

    /** A cada 15 min, entre 06:00 e 12:00 (Brasília), tenta enfileirar lembretes no horário do contrato. */
    @Scheduled(cron = "0 */15 6-12 * * *", zone = "America/Sao_Paulo")
    public void executar() {
        jobRunTracker.runTrackedJobVoid(JobNames.WHATSAPP_HONORARIOS_VENCIMENTO, ctx -> {
            honorariosRecebivelWhatsAppService.processarLembretesVencimento();
            ctx.putMetadata("job", "honorarios_vencimento_whatsapp");
        });
    }
}
