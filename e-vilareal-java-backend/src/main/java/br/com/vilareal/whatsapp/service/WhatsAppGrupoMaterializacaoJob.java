package br.com.vilareal.whatsapp.service;

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

    private final WhatsAppGrupoMaterializacaoLockService lockService;

    public WhatsAppGrupoMaterializacaoJob(WhatsAppGrupoMaterializacaoLockService lockService) {
        this.lockService = lockService;
    }

    @Scheduled(fixedDelayString = "${whatsapp.grupos.intervalo-ms:900000}")
    public void tick() {
        try {
            lockService
                    .executarRodadaComLock()
                    .ifPresentOrElse(
                            result -> {},
                            () -> log.debug("WhatsApp grupos materialização tick ignorado: lock indisponível"));
        } catch (Exception e) {
            log.warn("WhatsApp grupos materialização tick falhou: {}", e.getMessage(), e);
        }
    }
}
