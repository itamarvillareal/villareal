package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppMediaProperties;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Higiene do staging outbound: remove órfãos na subida e diariamente (ShedLock).
 */
@Component
public class WhatsAppOutboundMediaStagingCleanupRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppOutboundMediaStagingCleanupRunner.class);

    private final WhatsAppOutboundMediaStagingService stagingService;
    private final WhatsAppMediaProperties whatsAppMediaProperties;

    public WhatsAppOutboundMediaStagingCleanupRunner(
            WhatsAppOutboundMediaStagingService stagingService, WhatsAppMediaProperties whatsAppMediaProperties) {
        this.stagingService = stagingService;
        this.whatsAppMediaProperties = whatsAppMediaProperties;
    }

    @Override
    public void run(ApplicationArguments args) {
        executarLimpeza("startup");
    }

    @Scheduled(cron = "${whatsapp.media.staging.cleanup-cron:0 0 4 * * *}")
    @SchedulerLock(
            name = "whatsapp-outbound-staging-cleanup",
            lockAtMostFor = "PT30M",
            lockAtLeastFor = "PT1M")
    public void limpezaDiaria() {
        executarLimpeza("scheduled");
    }

    private void executarLimpeza(String origem) {
        int ttlHoras = Math.max(1, whatsAppMediaProperties.getStagingTtlHoras());
        Duration maxAge = Duration.ofHours(ttlHoras);
        int removidos = stagingService.limparOrfaosAntigos(maxAge);
        log.debug("Limpeza staging outbound ({}) ttl={}h removidos={}", origem, ttlHoras, removidos);
    }
}
