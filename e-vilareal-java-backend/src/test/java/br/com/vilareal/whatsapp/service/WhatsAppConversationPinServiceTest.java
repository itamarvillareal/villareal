package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationPinRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class WhatsAppConversationPinServiceTest {

    @Mock
    private WhatsAppConversationPinRepository pinRepository;

    @InjectMocks
    private WhatsAppConversationPinService service;

    @Test
    void fixar_canonicalizaTelefone_e_fazUpsert() {
        String input = "5562983452868";
        service.fixar(input);

        ArgumentCaptor<Instant> instantCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(pinRepository).upsertPinnedAt(eq(input), instantCaptor.capture());
        assertThat(instantCaptor.getValue()).isNotNull();
    }

    @Test
    void desfixar_canonicalizaTelefone_e_remove() {
        String input = "5562983452868";
        service.desfixar(input);

        verify(pinRepository).deleteByPhoneNumber(input);
    }
}
