package br.com.vilareal.projudi;

import br.com.vilareal.email.GmailApiProvider;
import com.google.api.services.gmail.Gmail;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjudiTokenReaderServiceTest {

    @Mock
    private GmailApiProvider gmailApiProvider;

    private ProjudiTokenReaderService reader;

    @BeforeEach
    void setUp() {
        reader = new ProjudiTokenReaderService(
                gmailApiProvider,
                "me",
                "otp-projudi@tjgo.jus.br",
                "(\\d{6})");
    }

    @Test
    void isDisponivel_delegaAoProvider() {
        when(gmailApiProvider.isDisponivel()).thenReturn(true);
        assertThat(reader.isDisponivel()).isTrue();
    }

    @Test
    void aguardarToken_gmailIndisponivel_falhaImediataSemPolling() {
        when(gmailApiProvider.resolver()).thenReturn(Optional.empty());

        Instant inicio = Instant.now();
        long antes = System.currentTimeMillis();

        assertThatThrownBy(() -> reader.aguardarToken(inicio, Duration.ofMinutes(2)))
                .isInstanceOf(ProjudiOtpGmailIndisponivelException.class)
                .hasMessageContaining(ProjudiOtpGmailIndisponivelException.MENSAGEM);

        long decorridoMs = System.currentTimeMillis() - antes;
        assertThat(decorridoMs).isLessThan(500L);
    }

    @Test
    void aguardarToken_gmailPresente_semEmailsNoGmailApi_retornaVazioAposTimeoutCurto() throws Exception {
        Gmail gmail = mock(Gmail.class, org.mockito.Answers.RETURNS_DEEP_STUBS);
        when(gmailApiProvider.resolver()).thenReturn(Optional.of(gmail));
        lenient()
                .when(gmail.users().messages().list("me").setQ(org.mockito.ArgumentMatchers.anyString())
                        .setIncludeSpamTrash(true)
                        .setMaxResults(50L)
                        .setPageToken(null)
                        .execute())
                .thenReturn(new com.google.api.services.gmail.model.ListMessagesResponse());

        Instant inicio = Instant.now();
        Optional<String> token = reader.aguardarToken(inicio, Duration.ofMillis(50));

        assertThat(token).isEmpty();
    }
}
