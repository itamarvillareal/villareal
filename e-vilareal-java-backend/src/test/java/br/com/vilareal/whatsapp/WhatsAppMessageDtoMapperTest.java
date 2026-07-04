package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class WhatsAppMessageDtoMapperTest {

    @Test
    void mediaProxyUrlParaImagem() {
        WhatsAppMessageEntity entity = new WhatsAppMessageEntity();
        entity.setId(42L);
        entity.setMessageType(WhatsAppMessageType.IMAGE);
        entity.setDirection(WhatsAppMessageDirection.INBOUND);
        entity.setStatus(WhatsAppMessageStatus.RECEIVED);
        entity.setPhoneNumber("5562999999999");

        assertEquals("/api/whatsapp/media/42", WhatsAppMessageDtoMapper.resolverMediaProxyUrl(entity));
    }

    @Test
    void mediaProxyUrlNullParaTexto() {
        WhatsAppMessageEntity entity = new WhatsAppMessageEntity();
        entity.setId(7L);
        entity.setMessageType(WhatsAppMessageType.TEXT);
        entity.setDirection(WhatsAppMessageDirection.INBOUND);
        entity.setStatus(WhatsAppMessageStatus.RECEIVED);
        entity.setPhoneNumber("5562999999999");

        assertNull(WhatsAppMessageDtoMapper.resolverMediaProxyUrl(entity));
    }

    @Test
    void mediaProxyUrlQuandoMediaIdPresente() {
        WhatsAppMessageEntity entity = new WhatsAppMessageEntity();
        entity.setId(99L);
        entity.setMessageType(WhatsAppMessageType.UNKNOWN);
        entity.setMediaId("meta-media-id");
        entity.setDirection(WhatsAppMessageDirection.INBOUND);
        entity.setStatus(WhatsAppMessageStatus.RECEIVED);
        entity.setPhoneNumber("5562999999999");

        assertEquals("/api/whatsapp/media/99", WhatsAppMessageDtoMapper.resolverMediaProxyUrl(entity));
    }
}
