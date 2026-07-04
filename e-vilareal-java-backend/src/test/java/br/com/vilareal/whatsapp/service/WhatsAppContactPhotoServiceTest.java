package br.com.vilareal.whatsapp.service;

import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.whatsapp.WhatsAppContactPhotoSupport;
import br.com.vilareal.whatsapp.WhatsAppMediaCategory;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppContactPhotoEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppContactPhotoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppContactPhotoServiceTest {

    private static final String PHONE = "5562983452868";
    private static final String PHONE2 = "5562993191778";

    @Mock
    private WhatsAppContactPhotoRepository contactPhotoRepository;

    @Mock
    private WhatsAppMediaValidation mediaValidation;

    @Mock
    private GoogleDriveService googleDriveService;

    @InjectMocks
    private WhatsAppContactPhotoService service;

    @Test
    void definirFoto_fazUploadDrive_e_upsert() throws Exception {
        MockMultipartFile file =
                new MockMultipartFile("arquivo", "foto.jpg", "image/jpeg", new byte[] {(byte) 0xFF, (byte) 0xD8, 0x01});

        when(googleDriveService.isConfigurado()).thenReturn(true);
        when(mediaValidation.validar("image/jpeg", file.getSize()))
                .thenReturn(new WhatsAppMediaValidation.ValidationResult(WhatsAppMediaCategory.IMAGE, "image/jpeg"));
        when(googleDriveService.getRootFolderId()).thenReturn("root");
        when(googleDriveService.encontrarOuCriarPastaPublic("WhatsApp", "root")).thenReturn("wa");
        when(googleDriveService.encontrarOuCriarPastaPublic("Fotos", "wa")).thenReturn("fotos");
        when(googleDriveService.uploadArquivo(any(), eq("foto_" + PHONE + ".jpg"), eq("image/jpeg"), eq("fotos")))
                .thenReturn(new DriveArquivoDto("file-1", "foto.jpg", "file", "image/jpeg", 2L, null, "https://drive/x", null, null));

        String url = service.definirFoto(PHONE, file);

        assertThat(url).isEqualTo(WhatsAppContactPhotoSupport.proxyUrl(PHONE));
        ArgumentCaptor<String> fileIdCaptor = ArgumentCaptor.forClass(String.class);
        verify(contactPhotoRepository)
                .upsert(eq(PHONE), fileIdCaptor.capture(), eq("https://drive/x"), any());
        assertThat(fileIdCaptor.getValue()).isEqualTo("file-1");
    }

    @Test
    void definirFoto_rejeitaNaoImagem() {
        MockMultipartFile file =
                new MockMultipartFile("arquivo", "doc.pdf", "application/pdf", new byte[] {1, 2, 3});

        when(googleDriveService.isConfigurado()).thenReturn(true);
        when(mediaValidation.validar(anyString(), eq(3L)))
                .thenReturn(new WhatsAppMediaValidation.ValidationResult(
                        WhatsAppMediaCategory.DOCUMENT, "application/pdf"));

        assertThatThrownBy(() -> service.definirFoto(PHONE, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JPEG ou PNG");
    }

    @Test
    void removerFoto_canonicaliza_e_apaga() {
        service.removerFoto(PHONE);

        verify(contactPhotoRepository).deleteByPhoneNumber(PHONE);
    }

    @Test
    void resolverUrlsPorTelefone_retornaProxySoParaQuemTemFoto() {
        WhatsAppContactPhotoEntity entity = new WhatsAppContactPhotoEntity();
        entity.setPhoneNumber(PHONE);
        entity.setDriveFileId("file-1");
        when(contactPhotoRepository.findByPhoneNumberIn(List.of(PHONE, PHONE2))).thenReturn(List.of(entity));

        Map<String, String> urls = service.resolverUrlsPorTelefone(List.of(PHONE, PHONE2));

        assertThat(urls).hasSize(1);
        assertThat(urls.get(PHONE)).isEqualTo("/api/whatsapp/conversations/" + PHONE + "/photo");
        assertThat(urls.get(PHONE2)).isNull();
    }

    @Test
    void buscarPorTelefone_retornaEntidade() {
        WhatsAppContactPhotoEntity entity = new WhatsAppContactPhotoEntity();
        entity.setPhoneNumber(PHONE);
        entity.setDriveFileId("file-1");

        when(contactPhotoRepository.findById(PHONE)).thenReturn(Optional.of(entity));

        assertThat(service.buscarPorTelefone(PHONE)).contains(entity);
    }

    @Test
    void montarNomeArquivoDrive_usaExtensaoPorMime() {
        assertThat(WhatsAppContactPhotoService.montarNomeArquivoDrive(PHONE, "image/jpeg"))
                .isEqualTo("foto_" + PHONE + ".jpg");
        assertThat(WhatsAppContactPhotoService.montarNomeArquivoDrive(PHONE, "image/png"))
                .isEqualTo("foto_" + PHONE + ".png");
    }
}
