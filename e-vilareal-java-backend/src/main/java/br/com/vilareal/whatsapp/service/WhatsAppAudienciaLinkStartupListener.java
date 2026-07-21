package br.com.vilareal.whatsapp.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@Profile("prod")
public class WhatsAppAudienciaLinkStartupListener {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppAudienciaLinkStartupListener.class);

    private final WhatsAppTemplateService whatsAppTemplateService;

    public WhatsAppAudienciaLinkStartupListener(WhatsAppTemplateService whatsAppTemplateService) {
        this.whatsAppTemplateService = whatsAppTemplateService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        log.info("Verificando template lembrete_audiencia_link na Meta…");
        whatsAppTemplateService.garantirTemplateLembreteAudienciaLink();
    }
}
