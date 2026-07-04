package br.com.vilareal.whatsapp.service;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Job periódico que materializa clientes por conversa WhatsApp em {@code whatsapp_conversa_cliente}.
 */
@Component
public class WhatsAppGrupoMaterializacaoJob {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppGrupoMaterializacaoJob.class);

    private final WhatsAppGrupoMaterializacaoService materializacaoService;

    public WhatsAppGrupoMaterializacaoJob(WhatsAppGrupoMaterializacaoService materializacaoService) {
        this.materializacaoService = materializacaoService;
    }

    @Scheduled(fixedDelayString = "${whatsapp.grupos.intervalo-ms:900000}")
    @SchedulerLock(
            name = "whatsapp-grupos-materializacao",
            lockAtMostFor = "PT10M",
            lockAtLeastFor = "PT30S")
    public void tick() {
        try {
            materializacaoService.executarRodada();
        } catch (Exception e) {
            log.warn("WhatsApp grupos materialização tick falhou: {}", e.getMessage(), e);
        }
    }
}
