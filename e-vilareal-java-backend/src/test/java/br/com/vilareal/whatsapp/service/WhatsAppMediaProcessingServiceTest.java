package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppMediaProperties;
import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaDownloadResult;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.task.SyncTaskExecutor;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppMediaProcessingServiceTest {

    @Mock
    private WhatsAppMediaService whatsAppMediaService;

    @Mock
    private WhatsAppMessageRepository whatsAppMessageRepository;

    @Mock
    private WhatsAppNotificationService whatsAppNotificationService;

    private WhatsAppMediaProperties properties;
    private WhatsAppMediaProcessingService service;

    @BeforeEach
    void setUp() {
        properties = new WhatsAppMediaProperties();
        properties.setMaxTentativas(5);
        service = new WhatsAppMediaProcessingService(
                whatsAppMediaService,
                whatsAppMessageRepository,
                whatsAppNotificationService,
                properties,
                new SyncTaskExecutor());
    }

    @Test
    void sucessoMarcaDoneENotifica() {
        WhatsAppMessageEntity entity = mensagemBase();
        when(whatsAppMessageRepository.findByWaMessageId("wa1")).thenReturn(Optional.of(entity));

        service.aplicarResultadoMidia("wa1", new WhatsAppMediaDownloadResult.Sucesso("https://drive/link", "file123"));

        assertThat(entity.getMediaStatus()).isEqualTo(WhatsAppMediaStatus.DONE);
        assertThat(entity.getMediaDriveUrl()).isEqualTo("https://drive/link");
        assertThat(entity.getMediaError()).isNull();
        verify(whatsAppNotificationService).notifyMediaReady(any(), any(), any(), any(), any());
    }

    @Test
    void driveNaoConfiguradoMantemPendingSemIncrementarTentativas() {
        WhatsAppMessageEntity entity = mensagemBase();
        entity.setMediaDownloadAttempts(2);
        when(whatsAppMessageRepository.findByWaMessageId("wa1")).thenReturn(Optional.of(entity));

        service.aplicarResultadoMidia("wa1", WhatsAppMediaDownloadResult.Falha.driveNaoConfigurado());

        assertThat(entity.getMediaStatus()).isEqualTo(WhatsAppMediaStatus.PENDING);
        assertThat(entity.getMediaDownloadAttempts()).isEqualTo(2);
        assertThat(entity.getMediaError()).isEqualTo("drive_nao_configurado");
        verify(whatsAppNotificationService, never()).notifyMediaReady(any(), any(), any(), any(), any());
    }

    @Test
    void falhaPermanenteMarcaFailedNaPrimeiraTentativa() {
        WhatsAppMessageEntity entity = mensagemBase();
        when(whatsAppMessageRepository.findByWaMessageId("wa1")).thenReturn(Optional.of(entity));

        service.aplicarResultadoMidia("wa1", WhatsAppMediaDownloadResult.Falha.permanente("meta_info_indisponivel"));

        assertThat(entity.getMediaStatus()).isEqualTo(WhatsAppMediaStatus.FAILED);
        assertThat(entity.getMediaDownloadAttempts()).isEqualTo(1);
        assertThat(entity.getMediaError()).isEqualTo("meta_info_indisponivel");
    }

    @Test
    void falhaTransitoriaMantemPendingAteMaxTentativas() {
        WhatsAppMessageEntity entity = mensagemBase();
        entity.setMediaDownloadAttempts(4);
        when(whatsAppMessageRepository.findByWaMessageId("wa1")).thenReturn(Optional.of(entity));

        service.aplicarResultadoMidia("wa1", WhatsAppMediaDownloadResult.Falha.transitoria("drive_falha"));

        assertThat(entity.getMediaStatus()).isEqualTo(WhatsAppMediaStatus.FAILED);
        assertThat(entity.getMediaDownloadAttempts()).isEqualTo(5);
    }

    @Test
    void executarProcessamentoMidiaPersisteResultadoDoDownload() {
        WhatsAppMessageEntity entity = mensagemBase();
        when(whatsAppMediaService.downloadAndSaveMedia("mid1", "f.jpg", "image/jpeg", "João", "5562"))
                .thenReturn(new WhatsAppMediaDownloadResult.Sucesso("https://drive/x", "id1"));
        when(whatsAppMessageRepository.findByWaMessageId("wa1")).thenReturn(Optional.of(entity));

        service.executarProcessamentoMidia("wa1", "mid1", "f.jpg", "image/jpeg", "João", "5562");

        ArgumentCaptor<WhatsAppMessageEntity> captor = ArgumentCaptor.forClass(WhatsAppMessageEntity.class);
        verify(whatsAppMessageRepository).save(captor.capture());
        assertThat(captor.getValue().getMediaStatus()).isEqualTo(WhatsAppMediaStatus.DONE);
    }

    private static WhatsAppMessageEntity mensagemBase() {
        WhatsAppMessageEntity entity = new WhatsAppMessageEntity();
        entity.setId(10L);
        entity.setWaMessageId("wa1");
        entity.setPhoneNumber("5562999999999");
        entity.setMediaId("mid1");
        entity.setMediaStatus(WhatsAppMediaStatus.PENDING);
        return entity;
    }
}
