package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppMessageDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import org.springframework.util.StringUtils;

import java.util.Set;

/** Montagem de {@link WhatsAppMessageDTO} e regras de mídia para o proxy inline. */
public final class WhatsAppMessageDtoMapper {

    private static final Set<String> MEDIA_TYPES = Set.of("IMAGE", "DOCUMENT", "AUDIO", "VIDEO");

    private WhatsAppMessageDtoMapper() {}

    public static boolean temMidiaParaProxy(WhatsAppMessageEntity entity) {
        if (entity == null) {
            return false;
        }
        if (StringUtils.hasText(entity.getMediaId())) {
            return true;
        }
        if (entity.getMessageType() == null) {
            return false;
        }
        return MEDIA_TYPES.contains(entity.getMessageType().name());
    }

    public static String resolverMediaProxyUrl(WhatsAppMessageEntity entity) {
        if (!temMidiaParaProxy(entity) || entity.getId() == null) {
            return null;
        }
        return "/api/whatsapp/media/" + entity.getId();
    }

    public static WhatsAppMessageDTO fromEntity(WhatsAppMessageEntity entity, String contactNameResolvido) {
        return new WhatsAppMessageDTO(
                entity.getId(),
                entity.getWaMessageId(),
                entity.getPhoneNumber(),
                contactNameResolvido,
                entity.getDirection() != null ? entity.getDirection().name() : null,
                entity.getMessageType() != null ? entity.getMessageType().name() : null,
                entity.getContent(),
                entity.getTemplateName(),
                entity.getStatus() != null ? entity.getStatus().name() : null,
                entity.getClienteId(),
                entity.getProcessoId(),
                entity.getMediaId(),
                entity.getMediaMimeType(),
                entity.getMediaFilename(),
                entity.getMediaDriveUrl(),
                resolverMediaProxyUrl(entity),
                entity.getCreatedAt());
    }
}
