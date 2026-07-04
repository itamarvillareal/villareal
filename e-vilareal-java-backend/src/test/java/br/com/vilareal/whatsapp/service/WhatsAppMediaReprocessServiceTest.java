package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppMediaProperties;
import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaDownloadResult;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppMediaReprocessServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-04T12:00:00Z");

    @Mock
    private WhatsAppMessageRepository whatsAppMessageRepository;

    @Mock
    private WhatsAppMediaProcessingService whatsAppMediaProcessingService;

    @Mock
    private WhatsAppMediaProperties whatsAppMediaProperties;

    private WhatsAppMediaReprocessService service;

    @BeforeEach
    void setUp() {
        service =
                new WhatsAppMediaReprocessService(
                        whatsAppMessageRepository,
                        whatsAppMediaProcessingService,
                        whatsAppMediaProperties,
                        Clock.fixed(NOW, ZoneOffset.UTC));
        when(whatsAppMediaProperties.getReprocessLote()).thenReturn(20);
        when(whatsAppMediaProperties.getReprocessMinIntervaloMs()).thenReturn(300_000L);
    }

    @Test
    void executarRodadaProcessaPendentesEIsolaExcecao() {
        WhatsAppMessageEntity ok = mensagem(1L, "wa-ok");
        WhatsAppMessageEntity boom = mensagem(2L, "wa-boom");
        when(whatsAppMessageRepository.findMidiaPendenteParaReprocessamento(
                        eq(WhatsAppMediaStatus.PENDING),
                        eq(WhatsAppMessageDirection.INBOUND),
                        any(Instant.class),
                        any(Pageable.class)))
                .thenReturn(List.of(ok, boom));

        WhatsAppMessageEntity okDone = mensagem(1L, "wa-ok");
        okDone.setMediaStatus(WhatsAppMediaStatus.DONE);
        when(whatsAppMessageRepository.findById(1L)).thenReturn(Optional.of(okDone));
        when(whatsAppMessageRepository.findById(2L)).thenReturn(Optional.of(boom));

        doThrow(new RuntimeException("falha simulada"))
                .when(whatsAppMediaProcessingService)
                .executarProcessamentoMidia(eq("wa-boom"), any(), any(), any(), any(), any());

        service.executarRodada();

        verify(whatsAppMediaProcessingService)
                .executarProcessamentoMidia("wa-ok", "mid-1", "f.jpg", "image/jpeg", "Contato", "5562");
        verify(whatsAppMediaProcessingService)
                .executarProcessamentoMidia("wa-boom", "mid-2", "f.jpg", "image/jpeg", "Contato", "5562");
    }

    @Test
    void executarRodadaSemCandidatosNaoProcessa() {
        when(whatsAppMessageRepository.findMidiaPendenteParaReprocessamento(
                        eq(WhatsAppMediaStatus.PENDING),
                        eq(WhatsAppMessageDirection.INBOUND),
                        any(Instant.class),
                        any(Pageable.class)))
                .thenReturn(List.of());

        service.executarRodada();

        verify(whatsAppMediaProcessingService, never()).executarProcessamentoMidia(any(), any(), any(), any(), any(), any());
    }

    @Test
    void executarRodadaConsultaApenasInbound() {
        when(whatsAppMessageRepository.findMidiaPendenteParaReprocessamento(
                        eq(WhatsAppMediaStatus.PENDING),
                        eq(WhatsAppMessageDirection.INBOUND),
                        any(Instant.class),
                        any(Pageable.class)))
                .thenReturn(List.of());

        service.executarRodada();

        verify(whatsAppMessageRepository)
                .findMidiaPendenteParaReprocessamento(
                        eq(WhatsAppMediaStatus.PENDING),
                        eq(WhatsAppMessageDirection.INBOUND),
                        any(Instant.class),
                        any(Pageable.class));
    }

    private static WhatsAppMessageEntity mensagem(long id, String waMessageId) {
        WhatsAppMessageEntity entity = new WhatsAppMessageEntity();
        entity.setId(id);
        entity.setWaMessageId(waMessageId);
        entity.setMediaId("mid-" + id);
        entity.setMediaFilename("f.jpg");
        entity.setMediaMimeType("image/jpeg");
        entity.setContactName("Contato");
        entity.setPhoneNumber("5562");
        entity.setMediaStatus(WhatsAppMediaStatus.PENDING);
        return entity;
    }
}
