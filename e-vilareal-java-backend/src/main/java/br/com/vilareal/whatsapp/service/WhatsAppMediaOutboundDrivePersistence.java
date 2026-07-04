package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Persistência transacional do resultado Drive outbound (proxy {@code @Transactional} separado).
 */
@Service
public class WhatsAppMediaOutboundDrivePersistence {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppMediaOutboundDrivePersistence.class);
    private static final int MAX_MEDIA_ERROR_LEN = 500;

    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final WhatsAppNotificationService whatsAppNotificationService;

    public WhatsAppMediaOutboundDrivePersistence(
            WhatsAppMessageRepository whatsAppMessageRepository,
            WhatsAppNotificationService whatsAppNotificationService) {
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.whatsAppNotificationService = whatsAppNotificationService;
    }

    @Transactional
    public void marcarSucesso(Long messageId, String webViewLink, String fileId) {
        WhatsAppMessageEntity message = carregar(messageId);
        message.setMediaDriveUrl(webViewLink);
        message.setMediaDriveFileId(fileId);
        message.setMediaStatus(WhatsAppMediaStatus.DONE);
        message.setMediaError(null);
        whatsAppMessageRepository.save(message);

        try {
            whatsAppNotificationService.notifyMediaReady(
                    message.getId(),
                    message.getPhoneNumber(),
                    message.getWaMessageId(),
                    webViewLink,
                    message.getMediaFilename());
        } catch (Exception e) {
            log.warn("Falha ao notificar mídia outbound pronta via SSE: {}", e.getMessage());
        }
    }

    @Transactional
    public void marcarFalha(Long messageId, String motivo) {
        WhatsAppMessageEntity message = carregar(messageId);
        message.setMediaStatus(WhatsAppMediaStatus.FAILED);
        message.setMediaError(truncarErro(motivo));
        whatsAppMessageRepository.save(message);
        log.warn(
                "Mídia outbound messageId={} waMessageId={} falhou no Drive: {}",
                messageId,
                message.getWaMessageId(),
                motivo);
    }

    private WhatsAppMessageEntity carregar(Long messageId) {
        return whatsAppMessageRepository
                .findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Mensagem não encontrada: " + messageId));
    }

    private static String truncarErro(String erro) {
        if (!StringUtils.hasText(erro)) {
            return "drive_falha";
        }
        return erro.length() <= MAX_MEDIA_ERROR_LEN ? erro : erro.substring(0, MAX_MEDIA_ERROR_LEN);
    }
}
