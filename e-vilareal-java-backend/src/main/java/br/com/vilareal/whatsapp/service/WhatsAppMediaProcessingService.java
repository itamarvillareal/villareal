package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppMediaProperties;
import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaDownloadResult;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.concurrent.CompletableFuture;

/**
 * Orquestra download async de mídia inbound, persistência de status e SSE.
 * Reutilizado pelo webhook ({@link WhatsAppService}) e pelo job de reprocessamento (Passo 4).
 */
@Service
public class WhatsAppMediaProcessingService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppMediaProcessingService.class);
    private static final int MAX_MEDIA_ERROR_LEN = 500;

    private final WhatsAppMediaService whatsAppMediaService;
    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final WhatsAppNotificationService whatsAppNotificationService;
    private final WhatsAppMediaProperties whatsAppMediaProperties;
    private final TaskExecutor whatsappMediaExecutor;

    public WhatsAppMediaProcessingService(
            WhatsAppMediaService whatsAppMediaService,
            WhatsAppMessageRepository whatsAppMessageRepository,
            WhatsAppNotificationService whatsAppNotificationService,
            WhatsAppMediaProperties whatsAppMediaProperties,
            @Qualifier("whatsappMediaExecutor") TaskExecutor whatsappMediaExecutor) {
        this.whatsAppMediaService = whatsAppMediaService;
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.whatsAppNotificationService = whatsAppNotificationService;
        this.whatsAppMediaProperties = whatsAppMediaProperties;
        this.whatsappMediaExecutor = whatsappMediaExecutor;
    }

    /** Dispara processamento em background (1 tentativa; retry fica para o job agendado). */
    public void agendarProcessamentoMidia(
            String waMessageId,
            String mediaId,
            String filename,
            String mimeType,
            String contactName,
            String phoneNumber) {
        CompletableFuture.runAsync(
                        () -> executarProcessamentoMidia(
                                waMessageId, mediaId, filename, mimeType, contactName, phoneNumber),
                        whatsappMediaExecutor)
                .exceptionally(ex -> {
                    log.error(
                            "Falha inesperada no runnable de mídia waMessageId={}: {}",
                            waMessageId,
                            ex.getMessage(),
                            ex);
                    persistirFalhaInesperada(waMessageId, ex);
                    return null;
                });
    }

    /**
     * Uma tentativa de download+upload+dedupe — chamado pelo async e pelo job (Passo 4).
     */
    public void executarProcessamentoMidia(
            String waMessageId,
            String mediaId,
            String filename,
            String mimeType,
            String contactName,
            String phoneNumber) {
        try {
            WhatsAppMediaDownloadResult result =
                    whatsAppMediaService.downloadAndSaveMedia(mediaId, filename, mimeType, contactName, phoneNumber);
            aplicarResultadoMidia(waMessageId, result);
        } catch (Exception e) {
            log.error("Erro ao processar mídia waMessageId={}: {}", waMessageId, e.getMessage(), e);
            aplicarResultadoMidia(
                    waMessageId,
                    WhatsAppMediaDownloadResult.Falha.transitoria("excecao:" + e.getClass().getSimpleName()));
        }
    }

    @Transactional
    public void aplicarResultadoMidia(String waMessageId, WhatsAppMediaDownloadResult result) {
        if (!StringUtils.hasText(waMessageId) || result == null) {
            return;
        }

        WhatsAppMessageEntity message =
                whatsAppMessageRepository.findByWaMessageId(waMessageId).orElse(null);
        if (message == null) {
            log.warn("aplicarResultadoMidia: mensagem não encontrada waMessageId={}", waMessageId);
            return;
        }

        switch (result) {
            case WhatsAppMediaDownloadResult.Sucesso sucesso -> aplicarSucesso(message, sucesso);
            case WhatsAppMediaDownloadResult.Falha falha -> aplicarFalha(message, falha);
        }
    }

    private void aplicarSucesso(WhatsAppMessageEntity message, WhatsAppMediaDownloadResult.Sucesso sucesso) {
        message.setMediaDriveUrl(sucesso.webViewLink());
        message.setMediaDriveFileId(sucesso.fileId());
        message.setMediaStatus(WhatsAppMediaStatus.DONE);
        message.setMediaError(null);
        whatsAppMessageRepository.save(message);

        try {
            whatsAppNotificationService.notifyMediaReady(
                    message.getId(),
                    message.getPhoneNumber(),
                    message.getWaMessageId(),
                    sucesso.webViewLink(),
                    message.getMediaFilename());
        } catch (Exception e) {
            log.warn("Falha ao notificar mídia pronta via SSE: {}", e.getMessage());
        }
    }

    private void aplicarFalha(WhatsAppMessageEntity message, WhatsAppMediaDownloadResult.Falha falha) {
        message.setMediaLastAttemptAt(Instant.now());
        message.setMediaError(truncarErro(falha.motivo()));

        if (falha.consumirTentativa()) {
            message.setMediaDownloadAttempts(message.getMediaDownloadAttempts() + 1);
        }

        message.setMediaStatus(resolverStatusAposFalha(message, falha));
        whatsAppMessageRepository.save(message);

        log.warn(
                "Falha ao salvar mídia messageId={} waMessageId={} motivo={} status={} tentativas={}",
                message.getId(),
                message.getWaMessageId(),
                falha.motivo(),
                message.getMediaStatus(),
                message.getMediaDownloadAttempts());
    }

    private WhatsAppMediaStatus resolverStatusAposFalha(
            WhatsAppMessageEntity message, WhatsAppMediaDownloadResult.Falha falha) {
        if (!falha.consumirTentativa()) {
            return WhatsAppMediaStatus.PENDING;
        }
        if (!falha.transitoria()) {
            return WhatsAppMediaStatus.FAILED;
        }
        if (message.getMediaDownloadAttempts() >= whatsAppMediaProperties.getMaxTentativas()) {
            return WhatsAppMediaStatus.FAILED;
        }
        return WhatsAppMediaStatus.PENDING;
    }

    private void persistirFalhaInesperada(String waMessageId, Throwable ex) {
        try {
            aplicarResultadoMidia(
                    waMessageId,
                    WhatsAppMediaDownloadResult.Falha.transitoria("excecao:" + ex.getClass().getSimpleName()));
        } catch (Exception persistEx) {
            log.error(
                    "Falha ao persistir erro de mídia waMessageId={}: {}",
                    waMessageId,
                    persistEx.getMessage(),
                    persistEx);
        }
    }

    private static String truncarErro(String erro) {
        if (erro == null) {
            return null;
        }
        return erro.length() <= MAX_MEDIA_ERROR_LEN ? erro : erro.substring(0, MAX_MEDIA_ERROR_LEN);
    }

    /**
     * Reprocessamento manual (botão "Tentar novamente" no front): reseta contadores e agenda download.
     */
    @Transactional
    public void solicitarReprocessamentoManual(Long messageId) {
        WhatsAppMessageEntity message = whatsAppMessageRepository
                .findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Mensagem não encontrada"));

        if (!StringUtils.hasText(message.getMediaId())) {
            throw new IllegalArgumentException("Mensagem sem mídia para reprocessar");
        }
        if (!StringUtils.hasText(message.getWaMessageId())) {
            throw new IllegalArgumentException("Mensagem sem identificador WhatsApp");
        }

        message.setMediaStatus(WhatsAppMediaStatus.PENDING);
        message.setMediaDownloadAttempts(0);
        message.setMediaError(null);
        message.setMediaLastAttemptAt(null);
        whatsAppMessageRepository.save(message);

        agendarProcessamentoMidia(
                message.getWaMessageId(),
                message.getMediaId(),
                message.getMediaFilename(),
                message.getMediaMimeType(),
                message.getContactName(),
                message.getPhoneNumber());
    }
}
