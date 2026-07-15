package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.WhatsAppDriveFileIdUtil;
import br.com.vilareal.whatsapp.WhatsAppForwardTextUtil;
import br.com.vilareal.whatsapp.WhatsAppMediaCategory;
import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.WhatsAppMessageType;
import br.com.vilareal.whatsapp.dto.WhatsAppForwardDestinationResult;
import br.com.vilareal.whatsapp.dto.WhatsAppForwardMessageResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppOutboundMediaResult;
import br.com.vilareal.whatsapp.dto.WhatsAppSendResponse;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Reenvia mensagens e mídias para outros contatos (a Meta não oferece "forward" nativo).
 */
@Service
public class WhatsAppForwardMessageService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppForwardMessageService.class);

    private final WhatsAppMessageRepository messageRepository;
    private final WhatsAppService whatsAppService;
    private final WhatsAppOutboundMediaService outboundMediaService;
    private final WhatsAppMediaBytesCacheService mediaBytesCacheService;
    private final WhatsAppOutboundMediaStagingService stagingService;

    public WhatsAppForwardMessageService(
            WhatsAppMessageRepository messageRepository,
            WhatsAppService whatsAppService,
            WhatsAppOutboundMediaService outboundMediaService,
            WhatsAppMediaBytesCacheService mediaBytesCacheService,
            WhatsAppOutboundMediaStagingService stagingService) {
        this.messageRepository = messageRepository;
        this.whatsAppService = whatsAppService;
        this.outboundMediaService = outboundMediaService;
        this.mediaBytesCacheService = mediaBytesCacheService;
        this.stagingService = stagingService;
    }

    public WhatsAppForwardMessageResponse encaminhar(Long messageId, List<String> phoneNumbers, String caption) {
        WhatsAppMessageEntity source = carregarMensagemAtiva(messageId);
        List<String> destinos = normalizarDestinos(phoneNumbers);
        if (destinos.isEmpty()) {
            throw new IllegalArgumentException("Informe ao menos um destinatário.");
        }

        List<WhatsAppForwardDestinationResult> results = new ArrayList<>();
        for (String phone : destinos) {
            results.add(encaminharPara(source, phone, caption));
        }

        boolean allOk = results.stream().allMatch(WhatsAppForwardDestinationResult::success);
        return new WhatsAppForwardMessageResponse(allOk, results);
    }

    private WhatsAppForwardDestinationResult encaminharPara(
            WhatsAppMessageEntity source, String phoneNumber, String captionOverride) {
        try {
            String formatted = WhatsAppService.formatPhoneNumber(phoneNumber);
            WhatsAppMessageType type = source.getMessageType();
            if (type == null) {
                throw new IllegalArgumentException("Tipo de mensagem desconhecido.");
            }
            if (type == WhatsAppMessageType.UNSUPPORTED) {
                throw new IllegalArgumentException("Este tipo de conteúdo não pode ser encaminhado.");
            }

            if (WhatsAppForwardTextUtil.isTipoMidia(type)) {
                return encaminharMidia(source, formatted, captionOverride);
            }

            String texto = WhatsAppForwardTextUtil.montarTextoEncaminhamento(type, source.getContent());
            if (!StringUtils.hasText(texto)) {
                throw new IllegalArgumentException("Mensagem sem conteúdo para encaminhar.");
            }

            WhatsAppSendResponse response = whatsAppService.sendTextMessage(formatted, texto);
            String waMessageId = WhatsAppService.extractMessageIdPublic(response);
            Long messageId = messageRepository
                    .findByWaMessageId(waMessageId)
                    .map(WhatsAppMessageEntity::getId)
                    .orElse(null);
            return new WhatsAppForwardDestinationResult(formatted, true, messageId, waMessageId, null);
        } catch (IllegalArgumentException e) {
            return falha(phoneNumber, e.getMessage());
        } catch (WhatsAppApiException e) {
            log.warn("Falha Meta ao encaminhar messageId={} para {}: {}", source.getId(), phoneNumber, e.getMessage());
            return falha(phoneNumber, e.getMessage());
        } catch (Exception e) {
            log.error(
                    "Erro inesperado ao encaminhar messageId={} para {}: {}",
                    source.getId(),
                    phoneNumber,
                    e.getMessage());
            return falha(phoneNumber, "Falha ao encaminhar mensagem.");
        }
    }

    private WhatsAppForwardDestinationResult encaminharMidia(
            WhatsAppMessageEntity source, String formattedPhone, String captionOverride) {
        Path tempFile = null;
        try {
            MediaSource media = resolverFonteMidia(source);
            String filename = StringUtils.hasText(source.getMediaFilename())
                    ? source.getMediaFilename().trim()
                    : "arquivo";
            String mime = StringUtils.hasText(source.getMediaMimeType())
                    ? source.getMediaMimeType().trim()
                    : "application/octet-stream";
            String caption = WhatsAppForwardTextUtil.extrairLegendaMidia(source.getContent(), captionOverride);

            tempFile = Files.createTempFile("whatsapp-forward-", "-" + sanitizarSuffix(filename));
            if (media.path() != null) {
                Files.copy(media.path(), tempFile, StandardCopyOption.REPLACE_EXISTING);
            } else {
                Files.write(tempFile, media.bytes());
            }

            WhatsAppMediaCategory category = WhatsAppMediaCategory.valueOf(source.getMessageType().name());
            WhatsAppOutboundMediaResult result =
                    outboundMediaService.enviarMidia(formattedPhone, tempFile, filename, mime, caption);
            tempFile = null;
            return new WhatsAppForwardDestinationResult(
                    formattedPhone,
                    true,
                    result.messageId(),
                    result.waMessageId(),
                    null);
        } catch (IllegalArgumentException e) {
            return falha(formattedPhone, e.getMessage());
        } catch (WhatsAppApiException e) {
            log.warn("Falha Meta ao encaminhar mídia messageId={} para {}: {}", source.getId(), formattedPhone, e.getMessage());
            return falha(formattedPhone, e.getMessage());
        } catch (Exception e) {
            log.error(
                    "Erro ao encaminhar mídia messageId={} para {}: {}",
                    source.getId(),
                    formattedPhone,
                    e.getMessage());
            return falha(formattedPhone, "Falha ao encaminhar mídia.");
        } finally {
            if (tempFile != null) {
                try {
                    Files.deleteIfExists(tempFile);
                } catch (Exception ignored) {
                    // noop
                }
            }
        }
    }

    private MediaSource resolverFonteMidia(WhatsAppMessageEntity source) throws Exception {
        String fileId = WhatsAppDriveFileIdUtil.resolverFileId(
                source.getMediaDriveFileId(), source.getMediaDriveUrl());
        if (StringUtils.hasText(fileId)) {
            return new MediaSource(mediaBytesCacheService.obterBytes(fileId), null);
        }

        Optional<Path> staged = stagingService.takeStagedFile(source.getId());
        if (staged.isPresent()) {
            return new MediaSource(null, staged.get());
        }

        WhatsAppMediaStatus mediaStatus = source.getMediaStatus();
        if (mediaStatus == WhatsAppMediaStatus.PENDING) {
            throw new IllegalArgumentException(
                    "A mídia ainda está sendo processada. Aguarde o download e tente novamente.");
        }
        if (mediaStatus == WhatsAppMediaStatus.FAILED) {
            throw new IllegalArgumentException(
                    "A mídia não está disponível no Drive. Use «Tentar novamente» antes de encaminhar.");
        }

        throw new IllegalArgumentException("Arquivo de mídia indisponível para encaminhamento.");
    }

    private static WhatsAppForwardDestinationResult falha(String phoneNumber, String error) {
        String formatted = phoneNumber;
        try {
            if (StringUtils.hasText(phoneNumber)) {
                formatted = WhatsAppService.formatPhoneNumber(phoneNumber);
            }
        } catch (IllegalArgumentException ignored) {
            formatted = StringUtils.hasText(phoneNumber) ? phoneNumber.trim() : "";
        }
        return new WhatsAppForwardDestinationResult(formatted, false, null, null, error);
    }

    private WhatsAppMessageEntity carregarMensagemAtiva(Long messageId) {
        if (messageId == null || messageId <= 0) {
            throw new IllegalArgumentException("ID de mensagem inválido.");
        }
        return messageRepository
                .findById(messageId)
                .filter(m -> m.getDeletedAt() == null)
                .orElseThrow(() -> new IllegalArgumentException("Mensagem não encontrada."));
    }

    private static List<String> normalizarDestinos(List<String> phoneNumbers) {
        if (phoneNumbers == null || phoneNumbers.isEmpty()) {
            return List.of();
        }
        Set<String> unicos = new LinkedHashSet<>();
        for (String phone : phoneNumbers) {
            if (!StringUtils.hasText(phone)) {
                continue;
            }
            unicos.add(WhatsAppService.formatPhoneNumber(phone.trim()));
        }
        return List.copyOf(unicos);
    }

    private static String sanitizarSuffix(String filename) {
        String safe = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
        return safe.length() > 80 ? safe.substring(0, 80) : safe;
    }

    private record MediaSource(byte[] bytes, Path path) {}
}
