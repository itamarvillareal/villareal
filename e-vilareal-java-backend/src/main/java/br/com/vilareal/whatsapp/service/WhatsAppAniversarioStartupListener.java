package br.com.vilareal.whatsapp.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@Profile("prod")
public class WhatsAppAniversarioStartupListener {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppAniversarioStartupListener.class);

    private final WhatsAppTemplateService whatsAppTemplateService;

    public WhatsAppAniversarioStartupListener(WhatsAppTemplateService whatsAppTemplateService) {
        this.whatsAppTemplateService = whatsAppTemplateService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        log.info("Verificando template de aniversário WhatsApp na Meta…");
        whatsAppTemplateService.garantirTemplateAniversario();
    }
}
