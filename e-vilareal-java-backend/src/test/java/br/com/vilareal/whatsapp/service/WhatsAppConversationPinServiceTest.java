package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationPinRepository;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class WhatsAppConversationPinServiceTest {

    private static final String PHONE = "5562983452868";
    private static final String PHONE2 = "556293191778";

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

    @Test
    void fixarLote_fixaVariosTelefones() {
        var result = service.fixarLote(List.of(PHONE, PHONE2));

        assertThat(result.fixados()).isEqualTo(2);
        assertThat(result.pulados()).isZero();
        verify(pinRepository, times(2)).upsertPinnedAt(any(), any(Instant.class));
    }

    @Test
    void fixarLote_pulaTelefoneInvalidoSemAbortar() {
        var result = service.fixarLote(List.of(PHONE, "invalido", "", PHONE2));

        assertThat(result.fixados()).isEqualTo(2);
        assertThat(result.pulados()).isEqualTo(2);
        verify(pinRepository, times(2)).upsertPinnedAt(any(), any(Instant.class));
    }

    @Test
    void fixarLote_idempotenteParaMesmoTelefone() {
        var result = service.fixarLote(List.of(PHONE, PHONE));

        assertThat(result.fixados()).isEqualTo(2);
        assertThat(result.pulados()).isZero();
        ArgumentCaptor<String> phones = ArgumentCaptor.forClass(String.class);
        verify(pinRepository, times(2)).upsertPinnedAt(phones.capture(), any(Instant.class));
        assertThat(phones.getAllValues()).containsOnly(PHONE);
    }
}
