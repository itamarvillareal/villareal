package br.com.vilareal.whatsapp.service;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job periódico de reprocessamento de mídia WhatsApp inbound pendente no Drive.
 */
@Component
public class WhatsAppMediaReprocessScheduler {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppMediaReprocessScheduler.class);

    private final WhatsAppMediaReprocessService whatsAppMediaReprocessService;

    public WhatsAppMediaReprocessScheduler(WhatsAppMediaReprocessService whatsAppMediaReprocessService) {
        this.whatsAppMediaReprocessService = whatsAppMediaReprocessService;
    }

    @Scheduled(fixedDelayString = "${whatsapp.media.reprocess.intervalo-ms:120000}")
    @SchedulerLock(
            name = "whatsapp-media-reprocess",
            lockAtMostFor = "PT10M",
            lockAtLeastFor = "PT30S")
    public void tick() {
        try {
            whatsAppMediaReprocessService.executarRodada();
        } catch (Exception e) {
            log.warn("WhatsApp mídia reprocess tick falhou: {}", e.getMessage(), e);
        }
    }
}
