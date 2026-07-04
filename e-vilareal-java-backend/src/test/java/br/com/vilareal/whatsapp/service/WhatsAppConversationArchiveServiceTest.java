package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppArquivarConversasLoteResultDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationArchiveRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppConversationArchiveServiceTest {

    private static final String PHONE = "5562983452868";
    private static final String PHONE2 = "556293191778";

    @Mock
    private WhatsAppConversationArchiveRepository archiveRepository;

    @InjectMocks
    private WhatsAppConversationArchiveService service;

    @Test
    void desarquivarSeExistir_removeQuandoExiste() {
        when(archiveRepository.existsById(PHONE)).thenReturn(true);

        service.desarquivarSeExistir(PHONE);

        verify(archiveRepository).deleteByPhoneNumber(PHONE);
    }

    @Test
    void desarquivarSeExistir_naoRemoveQuandoAusente() {
        when(archiveRepository.existsById(PHONE)).thenReturn(false);

        service.desarquivarSeExistir(PHONE);

        verify(archiveRepository, never()).deleteByPhoneNumber(eq(PHONE));
    }

    @Test
    void arquivarLote_arquivaVariosTelefones() {
        WhatsAppArquivarConversasLoteResultDTO result =
                service.arquivarLote(List.of(PHONE, PHONE2));

        assertThat(result.arquivados()).isEqualTo(2);
        assertThat(result.pulados()).isZero();
        verify(archiveRepository, times(2)).upsertArchivedAt(any(), any(Instant.class));
    }

    @Test
    void arquivarLote_pulaTelefoneInvalidoSemAbortar() {
        WhatsAppArquivarConversasLoteResultDTO result =
                service.arquivarLote(List.of(PHONE, "invalido", "", PHONE2));

        assertThat(result.arquivados()).isEqualTo(2);
        assertThat(result.pulados()).isEqualTo(2);
        verify(archiveRepository, times(2)).upsertArchivedAt(any(), any(Instant.class));
    }

    @Test
    void arquivarLote_idempotenteParaMesmoTelefone() {
        WhatsAppArquivarConversasLoteResultDTO result = service.arquivarLote(List.of(PHONE, PHONE));

        assertThat(result.arquivados()).isEqualTo(2);
        assertThat(result.pulados()).isZero();
        ArgumentCaptor<String> phones = ArgumentCaptor.forClass(String.class);
        verify(archiveRepository, times(2)).upsertArchivedAt(phones.capture(), any(Instant.class));
        assertThat(phones.getAllValues()).containsOnly(PHONE);
    }
}
