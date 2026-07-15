package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.WhatsAppMessageType;
import br.com.vilareal.whatsapp.dto.WhatsAppForwardMessageResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppOutboundMediaResult;
import br.com.vilareal.whatsapp.dto.WhatsAppSendResponse;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppForwardMessageServiceTest {

    @Mock
    private WhatsAppMessageRepository messageRepository;

    @Mock
    private WhatsAppService whatsAppService;

    @Mock
    private WhatsAppOutboundMediaService outboundMediaService;

    @Mock
    private WhatsAppMediaBytesCacheService mediaBytesCacheService;

    @Mock
    private WhatsAppOutboundMediaStagingService stagingService;

    @InjectMocks
    private WhatsAppForwardMessageService service;

    @Test
    void encaminhaTextoParaDestino() {
        WhatsAppMessageEntity source = mensagem(1L, WhatsAppMessageType.TEXT, "Olá, tudo bem?");
        when(messageRepository.findById(1L)).thenReturn(Optional.of(source));
        WhatsAppSendResponse sendResponse =
                new WhatsAppSendResponse("whatsapp", null, List.of(new WhatsAppSendResponse.Message("wamid.fwd", null)));
        when(whatsAppService.sendTextMessage("5511999999999", "Olá, tudo bem?")).thenReturn(sendResponse);

        WhatsAppMessageEntity persisted = mensagem(99L, WhatsAppMessageType.TEXT, "Olá, tudo bem?");
        persisted.setWaMessageId("wamid.fwd");
        when(messageRepository.findByWaMessageId("wamid.fwd")).thenReturn(Optional.of(persisted));

        WhatsAppForwardMessageResponse response =
                service.encaminhar(1L, List.of("5511999999999"), null);

        assertThat(response.success()).isTrue();
        assertThat(response.results()).hasSize(1);
        assertThat(response.results().getFirst().phoneNumber()).isEqualTo("5511999999999");
        assertThat(response.results().getFirst().messageId()).isEqualTo(99L);
        assertThat(response.results().getFirst().waMessageId()).isEqualTo("wamid.fwd");
    }

    @Test
    void encaminhaMidiaDoDrive() throws Exception {
        WhatsAppMessageEntity source = mensagem(2L, WhatsAppMessageType.IMAGE, "Legenda da foto");
        source.setMediaDriveFileId("drive-file-1");
        source.setMediaMimeType("image/jpeg");
        source.setMediaFilename("foto.jpg");
        source.setMediaStatus(WhatsAppMediaStatus.DONE);
        when(messageRepository.findById(2L)).thenReturn(Optional.of(source));
        when(mediaBytesCacheService.obterBytes("drive-file-1")).thenReturn(new byte[] {1, 2, 3});
        when(outboundMediaService.enviarMidia(
                        eq("5511888888888"), any(Path.class), eq("foto.jpg"), eq("image/jpeg"), eq("Legenda da foto")))
                .thenReturn(new WhatsAppOutboundMediaResult(10L, "wamid.media", WhatsAppMediaStatus.PENDING));

        WhatsAppForwardMessageResponse response =
                service.encaminhar(2L, List.of("5511888888888"), null);

        assertThat(response.success()).isTrue();
        assertThat(response.results().getFirst().messageId()).isEqualTo(10L);

        ArgumentCaptor<Path> pathCaptor = ArgumentCaptor.forClass(Path.class);
        verify(outboundMediaService)
                .enviarMidia(
                        eq("5511888888888"),
                        pathCaptor.capture(),
                        eq("foto.jpg"),
                        eq("image/jpeg"),
                        eq("Legenda da foto"));
        assertThat(pathCaptor.getValue()).isNotNull();
    }

    @Test
    void falhaQuandoMidiaAindaPendente() {
        WhatsAppMessageEntity source = mensagem(3L, WhatsAppMessageType.DOCUMENT, null);
        source.setMediaStatus(WhatsAppMediaStatus.PENDING);
        when(messageRepository.findById(3L)).thenReturn(Optional.of(source));
        when(stagingService.takeStagedFile(3L)).thenReturn(Optional.empty());

        WhatsAppForwardMessageResponse response =
                service.encaminhar(3L, List.of("5511777777777"), null);

        assertThat(response.success()).isFalse();
        assertThat(response.results().getFirst().error()).contains("processada");
    }

    @Test
    void rejeitaMensagemInexistente() {
        when(messageRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.encaminhar(404L, List.of("5511999999999"), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("não encontrada");
    }

    private static WhatsAppMessageEntity mensagem(Long id, WhatsAppMessageType type, String content) {
        WhatsAppMessageEntity entity = new WhatsAppMessageEntity();
        entity.setId(id);
        entity.setPhoneNumber("5511000000000");
        entity.setDirection(WhatsAppMessageDirection.INBOUND);
        entity.setMessageType(type);
        entity.setContent(content);
        return entity;
    }
}
