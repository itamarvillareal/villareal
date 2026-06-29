package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class AniversarioWhatsAppJob {

    private static final Logger log = LoggerFactory.getLogger(AniversarioWhatsAppJob.class);

    private final WhatsAppConfig whatsAppConfig;
    private final AniversarioWhatsAppService aniversarioWhatsAppService;
    private final JobRunTracker jobRunTracker;

    public AniversarioWhatsAppJob(
            WhatsAppConfig whatsAppConfig,
            AniversarioWhatsAppService aniversarioWhatsAppService,
            JobRunTracker jobRunTracker) {
        this.whatsAppConfig = whatsAppConfig;
        this.aniversarioWhatsAppService = aniversarioWhatsAppService;
        this.jobRunTracker = jobRunTracker;
    }

    @Scheduled(cron = "${whatsapp.aniversario.cron:0 0 8 * * *}", zone = "America/Sao_Paulo")
    public void enviarFelicitacoesAniversario() {
        try {
            jobRunTracker.runTrackedJobVoid(JobNames.WHATSAPP_ANIVERSARIO, ctx -> {
                if (!whatsAppConfig.isAniversarioEnabled()) {
                    log.debug("Job de aniversários WhatsApp desabilitado via configuração");
                    ctx.putMetadata("skipped", "disabled");
                    return;
                }
                AniversarioWhatsAppService.ExecucaoStats stats = aniversarioWhatsAppService.enviarFelicitacoesDoDia();
                ctx.setItemsProcessed(stats.enviados());
                ctx.setItemsFailed(stats.falhas() + stats.semTelefone());
                ctx.putMetadata("duplicados", stats.duplicados());
                ctx.putMetadata("semTelefone", stats.semTelefone());
            });
        } catch (Exception e) {
            log.error("Erro fatal no job de aniversários WhatsApp: {}", e.getMessage(), e);
        }
    }
}
