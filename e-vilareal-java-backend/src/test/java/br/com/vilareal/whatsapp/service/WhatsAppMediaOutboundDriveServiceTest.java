package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaDownloadResult;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.task.SyncTaskExecutor;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppMediaOutboundDriveServiceTest {

    @Mock
    private WhatsAppMediaService whatsAppMediaService;

    @Mock
    private WhatsAppMessageRepository whatsAppMessageRepository;

    @Mock
    private WhatsAppMediaOutboundDrivePersistence persistence;

    @Mock
    private WhatsAppNotificationService whatsAppNotificationService;

    @TempDir
    Path tempDir;

    private WhatsAppOutboundMediaStagingService stagingService;
    private WhatsAppMediaOutboundDriveService driveService;

    @BeforeEach
    void setUp() {
        stagingService = new WhatsAppOutboundMediaStagingService() {
            @Override
            Path getStagingDir() {
                return tempDir;
            }
        };
        driveService = new WhatsAppMediaOutboundDriveService(
                whatsAppMediaService,
                whatsAppMessageRepository,
                stagingService,
                persistence,
                new SyncTaskExecutor());
    }

    @Test
    void sucessoMarcaDoneRemoveStaged() throws Exception {
        WhatsAppMessageEntity entity = mensagemOutbound(7L);
        when(whatsAppMessageRepository.findById(7L)).thenReturn(Optional.of(entity));

        Path staged = tempDir.resolve("7_foto.jpg");
        Files.write(staged, new byte[] {1, 2, 3});

        when(whatsAppMediaService.saveOutboundMediaFromFile(
                        eq(staged), eq("mid-7"), eq("foto.jpg"), eq("image/jpeg"), eq("João"), eq("5562999")))
                .thenReturn(new WhatsAppMediaDownloadResult.Sucesso("https://drive/enviados", "file-7"));

        driveService.salvarMidiaEnviadaNoDrive(7L);

        verify(persistence).marcarSucesso(7L, "https://drive/enviados", "file-7");
        assertThat(stagingService.takeStagedFile(7L)).isEmpty();
    }

    @Test
    void stagingAusenteMarcaFailedELimpa() {
        WhatsAppMessageEntity entity = mensagemOutbound(8L);
        when(whatsAppMessageRepository.findById(8L)).thenReturn(Optional.of(entity));

        driveService.salvarMidiaEnviadaNoDrive(8L);

        verify(persistence).marcarFalha(8L, "staging_ausente");
        verify(whatsAppMediaService, never()).saveOutboundMediaFromFile(any(), any(), any(), any(), any(), any());
    }

    @Test
    void falhaDriveMarcaFailedERemoveStaged() throws Exception {
        WhatsAppMessageEntity entity = mensagemOutbound(9L);
        when(whatsAppMessageRepository.findById(9L)).thenReturn(Optional.of(entity));

        Path staged = tempDir.resolve("9_doc.pdf");
        Files.write(staged, new byte[] {5});

        when(whatsAppMediaService.saveOutboundMediaFromFile(any(), any(), any(), any(), any(), any()))
                .thenReturn(WhatsAppMediaDownloadResult.Falha.permanente("drive_falha"));

        driveService.salvarMidiaEnviadaNoDrive(9L);

        verify(persistence).marcarFalha(9L, "drive_falha");
        assertThat(stagingService.takeStagedFile(9L)).isEmpty();
    }

    @Test
    void agendarExecutaAsyncERemoveStaged() throws Exception {
        WhatsAppMessageEntity entity = mensagemOutbound(10L);
        when(whatsAppMessageRepository.findById(10L)).thenReturn(Optional.of(entity));

        Path staged = tempDir.resolve("10_x.jpg");
        Files.write(staged, new byte[] {7});
        when(whatsAppMediaService.saveOutboundMediaFromFile(any(), any(), any(), any(), any(), any()))
                .thenReturn(new WhatsAppMediaDownloadResult.Sucesso("https://drive/x", "id-x"));

        driveService.agendarSalvarMidiaEnviadaNoDrive(10L);

        verify(persistence).marcarSucesso(10L, "https://drive/x", "id-x");
        assertThat(stagingService.takeStagedFile(10L)).isEmpty();
    }

    private static WhatsAppMessageEntity mensagemOutbound(long id) {
        WhatsAppMessageEntity entity = new WhatsAppMessageEntity();
        entity.setId(id);
        entity.setWaMessageId("wa-" + id);
        entity.setMediaId("mid-" + id);
        entity.setMediaFilename("foto.jpg");
        entity.setMediaMimeType("image/jpeg");
        entity.setContactName("João");
        entity.setPhoneNumber("5562999");
        entity.setMediaStatus(WhatsAppMediaStatus.PENDING);
        return entity;
    }
}
