package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppMediaDownloadResult;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.file.Path;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Drive async para mídia outbound: lê staged file, salva em {@code WhatsApp/Enviados/}, marca DONE, SSE.
 * Irmão do fluxo inbound ({@link WhatsAppMediaProcessingService}) — sem job de retry.
 */
@Service
public class WhatsAppMediaOutboundDriveService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppMediaOutboundDriveService.class);

    private final WhatsAppMediaService whatsAppMediaService;
    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final WhatsAppOutboundMediaStagingService stagingService;
    private final WhatsAppMediaOutboundDrivePersistence persistence;
    private final TaskExecutor whatsappMediaExecutor;

    public WhatsAppMediaOutboundDriveService(
            WhatsAppMediaService whatsAppMediaService,
            WhatsAppMessageRepository whatsAppMessageRepository,
            WhatsAppOutboundMediaStagingService stagingService,
            WhatsAppMediaOutboundDrivePersistence persistence,
            @Qualifier("whatsappMediaExecutor") TaskExecutor whatsappMediaExecutor) {
        this.whatsAppMediaService = whatsAppMediaService;
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.stagingService = stagingService;
        this.persistence = persistence;
        this.whatsappMediaExecutor = whatsappMediaExecutor;
    }

    /** Dispara upload Drive em background (Passo 2, após envio síncrono à Meta). */
    public void agendarSalvarMidiaEnviadaNoDrive(Long messageId) {
        if (messageId == null) {
            return;
        }
        CompletableFuture.runAsync(() -> salvarMidiaEnviadaNoDrive(messageId), whatsappMediaExecutor)
                .exceptionally(ex -> {
                    log.error(
                            "Falha inesperada no runnable Drive outbound messageId={}: {}",
                            messageId,
                            ex.getMessage(),
                            ex);
                    try {
                        persistence.marcarFalha(
                                messageId, "excecao:" + ex.getClass().getSimpleName());
                    } catch (Exception persistEx) {
                        log.error(
                                "Falha ao persistir erro Drive outbound messageId={}: {}",
                                messageId,
                                persistEx.getMessage(),
                                persistEx);
                    } finally {
                        stagingService.deleteStaged(messageId);
                    }
                    return null;
                });
    }

    /**
     * Upload Drive a partir do staging. {@link WhatsAppOutboundMediaStagingService#deleteStaged(long)}
     * é chamado no {@code finally} — sucesso ou falha.
     */
    public void salvarMidiaEnviadaNoDrive(Long messageId) {
        try {
            WhatsAppMessageEntity message = whatsAppMessageRepository
                    .findById(messageId)
                    .orElse(null);
            if (message == null) {
                log.warn("salvarMidiaEnviadaNoDrive: mensagem não encontrada messageId={}", messageId);
                return;
            }
            if (!StringUtils.hasText(message.getMediaId())) {
                persistence.marcarFalha(messageId, "media_id_ausente");
                return;
            }

            Optional<Path> staged = stagingService.takeStagedFile(messageId);
            if (staged.isEmpty()) {
                persistence.marcarFalha(messageId, "staging_ausente");
                return;
            }

            Path filePath = staged.get();
            WhatsAppMediaDownloadResult result = whatsAppMediaService.saveOutboundMediaFromFile(
                    filePath,
                    message.getMediaId(),
                    message.getMediaFilename(),
                    message.getMediaMimeType(),
                    message.getContactName(),
                    message.getPhoneNumber());

            switch (result) {
                case WhatsAppMediaDownloadResult.Sucesso sucesso ->
                        persistence.marcarSucesso(messageId, sucesso.webViewLink(), sucesso.fileId());
                case WhatsAppMediaDownloadResult.Falha falha -> persistence.marcarFalha(messageId, falha.motivo());
            }
        } catch (Exception e) {
            log.error("Erro ao salvar mídia outbound no Drive messageId={}: {}", messageId, e.getMessage(), e);
            try {
                persistence.marcarFalha(messageId, "excecao:" + e.getClass().getSimpleName());
            } catch (Exception persistEx) {
                log.error(
                        "Falha ao persistir erro Drive outbound messageId={}: {}",
                        messageId,
                        persistEx.getMessage(),
                        persistEx);
            }
        } finally {
            stagingService.deleteStaged(messageId);
        }
    }
}
