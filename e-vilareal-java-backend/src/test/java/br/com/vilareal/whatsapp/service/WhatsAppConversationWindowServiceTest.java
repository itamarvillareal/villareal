package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppConversationWindowServiceTest {

    @Mock
    private WhatsAppMessageRepository messageRepository;

    @InjectMocks
    private WhatsAppConversationWindowService service;

    @Test
    void verificarJanelaAberta_comInboundRecente_true() {
        WhatsAppMessageEntity inbound = new WhatsAppMessageEntity();
        inbound.setDirection(WhatsAppMessageDirection.INBOUND);
        inbound.setCreatedAt(Instant.now().minus(1, ChronoUnit.HOURS));

        when(messageRepository.findLatestInboundByPhoneSuffixSince(eq("62992975894"), any(Instant.class)))
                .thenReturn(Optional.of(inbound));

        var res = service.verificarJanelaAberta("556292975894");

        assertThat(res.janelaAberta()).isTrue();
        assertThat(res.ultimaInboundAt()).isEqualTo(inbound.getCreatedAt());
    }

    @Test
    void verificarJanelaAberta_semInbound_false() {
        when(messageRepository.findLatestInboundByPhoneSuffixSince(eq("62992975894"), any(Instant.class)))
                .thenReturn(Optional.empty());

        var res = service.verificarJanelaAberta("5562992975894");

        assertThat(res.janelaAberta()).isFalse();
        assertThat(res.ultimaInboundAt()).isNull();
    }
}
