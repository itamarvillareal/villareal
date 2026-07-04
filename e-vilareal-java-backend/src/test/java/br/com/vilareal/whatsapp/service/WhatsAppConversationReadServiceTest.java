package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppMarcarLidasLoteResultDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationReadRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class WhatsAppConversationReadServiceTest {

    private static final String PHONE = "5562983452868";
    private static final String PHONE2 = "5562993191778";

    @Mock
    private WhatsAppConversationReadRepository readRepository;

    @Mock
    private WhatsAppMessageRepository messageRepository;

    @Mock
    private WhatsAppNotificationService whatsAppNotificationService;

    @InjectMocks
    private WhatsAppConversationReadService service;

    @Test
    void marcarComoLidaLote_marcaVariosTelefones() {
        WhatsAppMarcarLidasLoteResultDTO result = service.marcarComoLidaLote(List.of(PHONE, PHONE2));

        assertThat(result.marcados()).isEqualTo(2);
        assertThat(result.pulados()).isZero();
        verify(readRepository).upsertLastReadAt(eq(PHONE), any(Instant.class));
        verify(readRepository).upsertLastReadAt(eq(PHONE2), any(Instant.class));
        verify(whatsAppNotificationService, times(2)).notifyConversationRead(any(), any(Instant.class));
    }

    @Test
    void marcarComoLidaLote_pulaTelefoneInvalidoSemAbortar() {
        WhatsAppMarcarLidasLoteResultDTO result =
                service.marcarComoLidaLote(List.of(PHONE, "invalido", "", PHONE2));

        assertThat(result.marcados()).isEqualTo(2);
        assertThat(result.pulados()).isEqualTo(2);
        verify(readRepository, times(2)).upsertLastReadAt(any(), any(Instant.class));
    }
}
