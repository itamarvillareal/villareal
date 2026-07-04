package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.dto.WhatsAppOutboundMediaResult;
import br.com.vilareal.whatsapp.dto.WhatsAppSendResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Orquestra envio outbound de mídia: validação → upload Meta → send → persist → staging para Drive (Passo 2).
 */
@Service
public class WhatsAppOutboundMediaService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppOutboundMediaService.class);

    private final WhatsAppMediaValidation mediaValidation;
    private final WhatsAppMediaUploadService mediaUploadService;
    private final WhatsAppService whatsAppService;
    private final WhatsAppContactResolverService contactResolver;
    private final WhatsAppOutboundMediaStagingService stagingService;
    private final WhatsAppMediaOutboundDriveService outboundDriveService;

    public WhatsAppOutboundMediaService(
            WhatsAppMediaValidation mediaValidation,
            WhatsAppMediaUploadService mediaUploadService,
            WhatsAppService whatsAppService,
            WhatsAppContactResolverService contactResolver,
            WhatsAppOutboundMediaStagingService stagingService,
            WhatsAppMediaOutboundDriveService outboundDriveService) {
        this.mediaValidation = mediaValidation;
        this.mediaUploadService = mediaUploadService;
        this.whatsAppService = whatsAppService;
        this.contactResolver = contactResolver;
        this.stagingService = stagingService;
        this.outboundDriveService = outboundDriveService;
    }

    /**
     * Envia mídia outbound de forma síncrona (Meta). Drive async fica para o Passo 2.
     *
     * @param tempFile arquivo temporário (será movido para staging em sucesso, ou apagado em falha)
     */
    public WhatsAppOutboundMediaResult enviarMidia(
            String phoneNumber, Path tempFile, String filename, String mime, String caption) {
        if (tempFile == null || !Files.isRegularFile(tempFile)) {
            throw new IllegalArgumentException("Arquivo de mídia inválido.");
        }

        long sizeBytes;
        try {
            sizeBytes = Files.size(tempFile);
        } catch (IOException e) {
            stagingService.deleteQuietly(tempFile);
            throw new IllegalArgumentException("Não foi possível ler o arquivo de mídia.", e);
        }

        WhatsAppMediaValidation.ValidationResult validation;
        try {
            validation = mediaValidation.validar(mime, sizeBytes);
        } catch (IllegalArgumentException e) {
            stagingService.deleteQuietly(tempFile);
            throw e;
        }

        String formattedPhone = WhatsAppService.formatPhoneNumber(phoneNumber);
        String safeFilename = StringUtils.hasText(filename)
                ? filename
                : tempFile.getFileName().toString();

        try {
            String mediaId = mediaUploadService.uploadParaMeta(
                    tempFile, safeFilename, validation.normalizedMime(), sizeBytes);

            WhatsAppSendResponse sendResponse = whatsAppService.sendMediaMessage(
                    formattedPhone,
                    validation.category(),
                    mediaId,
                    safeFilename,
                    caption);

            return persistirEstagiarEretornar(
                    sendResponse,
                    formattedPhone,
                    validation,
                    mediaId,
                    safeFilename,
                    caption,
                    tempFile);
        } catch (WhatsAppApiException | IllegalArgumentException | IllegalStateException e) {
            stagingService.deleteQuietly(tempFile);
            throw e;
        } catch (RuntimeException e) {
            stagingService.deleteQuietly(tempFile);
            throw e;
        }
    }

    protected WhatsAppOutboundMediaResult persistirEstagiarEretornar(
            WhatsAppSendResponse sendResponse,
            String formattedPhone,
            WhatsAppMediaValidation.ValidationResult validation,
            String mediaId,
            String filename,
            String caption,
            Path tempFile) {
        String contactName = contactResolver.resolveContactName(formattedPhone, null);
        Long messageId = whatsAppService.persistOutboundMediaMessage(
                sendResponse,
                formattedPhone,
                validation.category(),
                mediaId,
                validation.normalizedMime(),
                filename,
                caption,
                contactName);

        String waMessageId = WhatsAppService.extractMessageIdPublic(sendResponse);

        try {
            stagingService.stageForDriveUpload(messageId, tempFile);
        } catch (IOException e) {
            log.warn(
                    "Mídia enviada (messageId={}) mas falha ao mover temp para staging Drive: {}",
                    messageId,
                    e.getMessage());
            stagingService.deleteQuietly(tempFile);
        }

        outboundDriveService.agendarSalvarMidiaEnviadaNoDrive(messageId);

        return new WhatsAppOutboundMediaResult(messageId, waMessageId, WhatsAppMediaStatus.PENDING);
    }
}
