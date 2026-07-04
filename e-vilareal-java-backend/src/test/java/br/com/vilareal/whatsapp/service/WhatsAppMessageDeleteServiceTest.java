package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppApagarConversaResultDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationArchiveRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationPinRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationReadRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteManualRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppMessageDeleteServiceTest {

    private static final String PHONE = "5562983452868";

    @Mock
    private WhatsAppMessageRepository messageRepository;

    @Mock
    private WhatsAppConversationPinRepository pinRepository;

    @Mock
    private WhatsAppConversationArchiveRepository archiveRepository;

    @Mock
    private WhatsAppConversationReadRepository readRepository;

    @Mock
    private WhatsAppConversaClienteManualRepository manualRepository;

    @InjectMocks
    private WhatsAppMessageDeleteService service;

    @Test
    void apagarMensagem_softDeleteIdempotente() {
        service.apagarMensagem(42L);

        ArgumentCaptor<Instant> when = ArgumentCaptor.forClass(Instant.class);
        verify(messageRepository).softDeleteById(eq(42L), when.capture());
        assertThat(when.getValue()).isNotNull();
        verify(messageRepository, never()).deleteById(any());
    }

    @Test
    void apagarMensagem_rejeitaIdInvalido() {
        assertThatThrownBy(() -> service.apagarMensagem(0L)).isInstanceOf(IllegalArgumentException.class);
        verify(messageRepository, never()).softDeleteById(any(), any());
    }

    @Test
    void apagarConversa_marcaMensagensELimpaEstado() {
        when(messageRepository.softDeleteByPhoneSuffix(eq("62983452868"), any(Instant.class))).thenReturn(3);

        WhatsAppApagarConversaResultDTO result = service.apagarConversa(PHONE);

        assertThat(result.mensagensAfetadas()).isEqualTo(3);
        verify(pinRepository).deleteByPhoneNumber(PHONE);
        verify(archiveRepository).deleteByPhoneNumber(PHONE);
        verify(readRepository).deleteByPhoneNumber(PHONE);
        verify(manualRepository).deleteByPhoneNumber(PHONE);
    }
}
