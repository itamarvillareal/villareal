package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationArchiveRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppConversationArchiveServiceTest {

    private static final String PHONE = "5562983452868";

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
}
