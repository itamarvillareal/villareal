package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.WhatsAppMessageType;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppMessageDeleteServiceRevokeTest {

    private static final String PHONE = "5562983452868";
    private static final String WAMID = "wamid.outbound.test";

    @Mock
    private br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository
            messageRepository;

    @Mock
    private br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationPinRepository
            pinRepository;

    @Mock
    private br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationArchiveRepository
            archiveRepository;

    @Mock
    private br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationReadRepository
            readRepository;

    @Mock
    private br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteManualRepository
            manualRepository;

    @Mock
    private WhatsAppService whatsAppService;

    @InjectMocks
    private WhatsAppMessageDeleteService service;

    @Test
    void apagarMensagemParaTodos_revogaNoWhatsAppESoftDelete() {
        WhatsAppMessageEntity entity = mensagemOutboundRecente();
        when(messageRepository.findById(42L)).thenReturn(Optional.of(entity));

        service.apagarMensagemParaTodos(42L);

        verify(whatsAppService).revokeOutboundMessage(WAMID, PHONE);
        verify(messageRepository).softDeleteById(eq(42L), any(Instant.class));
    }

    @Test
    void apagarMensagemParaTodos_rejeitaInbound() {
        WhatsAppMessageEntity entity = mensagemOutboundRecente();
        entity.setDirection(WhatsAppMessageDirection.INBOUND);
        when(messageRepository.findById(42L)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> service.apagarMensagemParaTodos(42L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("enviadas pelo escritório");

        verify(whatsAppService, never()).revokeOutboundMessage(any(), any());
        verify(messageRepository, never()).softDeleteById(any(), any());
    }

    @Test
    void apagarMensagemParaTodos_rejeitaForaDaJanela48h() {
        WhatsAppMessageEntity entity = mensagemOutboundRecente();
        entity.setCreatedAt(Instant.now().minus(49, ChronoUnit.HOURS));
        when(messageRepository.findById(42L)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> service.apagarMensagemParaTodos(42L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("48 horas");

        verify(whatsAppService, never()).revokeOutboundMessage(any(), any());
    }

    private static WhatsAppMessageEntity mensagemOutboundRecente() {
        WhatsAppMessageEntity entity = new WhatsAppMessageEntity();
        entity.setId(42L);
        entity.setWaMessageId(WAMID);
        entity.setPhoneNumber(PHONE);
        entity.setDirection(WhatsAppMessageDirection.OUTBOUND);
        entity.setMessageType(WhatsAppMessageType.TEXT);
        entity.setCreatedAt(Instant.now().minus(1, ChronoUnit.HOURS));
        return entity;
    }
}
