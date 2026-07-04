package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppMediaProperties;
import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

/**
 * Reprocessamento periódico de mídia WhatsApp inbound com status {@link WhatsAppMediaStatus#PENDING}.
 */
@Service
public class WhatsAppMediaReprocessService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppMediaReprocessService.class);

    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final WhatsAppMediaProcessingService whatsAppMediaProcessingService;
    private final WhatsAppMediaProperties whatsAppMediaProperties;
    private final Clock clock;

    public WhatsAppMediaReprocessService(
            WhatsAppMessageRepository whatsAppMessageRepository,
            WhatsAppMediaProcessingService whatsAppMediaProcessingService,
            WhatsAppMediaProperties whatsAppMediaProperties,
            Clock clock) {
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.whatsAppMediaProcessingService = whatsAppMediaProcessingService;
        this.whatsAppMediaProperties = whatsAppMediaProperties;
        this.clock = clock;
    }

    public void executarRodada() {
        int lote = Math.max(1, whatsAppMediaProperties.getReprocessLote());
        Instant tentativaAntesDe =
                clock.instant().minusMillis(whatsAppMediaProperties.getReprocessMinIntervaloMs());

        List<WhatsAppMessageEntity> candidatos = whatsAppMessageRepository.findMidiaPendenteParaReprocessamento(
                WhatsAppMediaStatus.PENDING,
                WhatsAppMessageDirection.INBOUND,
                tentativaAntesDe,
                PageRequest.of(0, lote));

        if (candidatos.isEmpty()) {
            log.debug("WhatsApp mídia reprocess: nenhum item elegível");
            return;
        }

        int done = 0;
        int stillPending = 0;
        int newlyFailed = 0;
        int erros = 0;

        for (WhatsAppMessageEntity message : candidatos) {
            WhatsAppMediaStatus statusAntes = message.getMediaStatus();
            try {
                if (!StringUtils.hasText(message.getWaMessageId()) || !StringUtils.hasText(message.getMediaId())) {
                    log.warn(
                            "WhatsApp mídia reprocess: item ignorado messageId={} (waMessageId ou mediaId ausente)",
                            message.getId());
                    continue;
                }
                whatsAppMediaProcessingService.executarProcessamentoMidia(
                        message.getWaMessageId(),
                        message.getMediaId(),
                        message.getMediaFilename(),
                        message.getMediaMimeType(),
                        message.getContactName(),
                        message.getPhoneNumber());
            } catch (Exception e) {
                erros++;
                log.error(
                        "WhatsApp mídia reprocess: exceção messageId={} waMessageId={}: {}",
                        message.getId(),
                        message.getWaMessageId(),
                        e.getMessage(),
                        e);
            }

            WhatsAppMediaStatus statusDepois = whatsAppMessageRepository
                    .findById(message.getId())
                    .map(WhatsAppMessageEntity::getMediaStatus)
                    .orElse(statusAntes);

            if (statusDepois == WhatsAppMediaStatus.DONE) {
                done++;
            } else if (statusDepois == WhatsAppMediaStatus.FAILED && statusAntes == WhatsAppMediaStatus.PENDING) {
                newlyFailed++;
            } else {
                stillPending++;
            }
        }

        log.info(
                "WhatsApp mídia reprocess: selecionados={} done={} pending={} failed_nesta_rodada={} erros={}",
                candidatos.size(),
                done,
                stillPending,
                newlyFailed,
                erros);
    }
}
