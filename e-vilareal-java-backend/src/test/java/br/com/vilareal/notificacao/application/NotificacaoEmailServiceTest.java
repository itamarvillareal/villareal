package br.com.vilareal.notificacao.application;

import br.com.vilareal.email.GmailApiProvider;
import br.com.vilareal.notificacao.config.NotificacaoEmailProperties;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.Profile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Base64;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificacaoEmailServiceTest {

    @Mock
    private GmailApiProvider gmailApiProvider;

    @Mock
    private Gmail gmail;

    @Mock
    private Gmail.Users users;

    @Mock
    private Gmail.Users.Messages messages;

    @Mock
    private Gmail.Users.GetProfile profileGet;

    @Mock
    private Gmail.Users.Messages.Send send;

    private NotificacaoEmailProperties properties;

    @BeforeEach
    void setUp() {
        properties = new NotificacaoEmailProperties();
        properties.setAtivo(true);
        properties.setFromNome("Monitor Villa Real");
    }

    @Test
    void enviar_gmailIndisponivel_lanca() {
        when(gmailApiProvider.resolver()).thenReturn(Optional.empty());
        NotificacaoEmailService service = new NotificacaoEmailService(gmailApiProvider, properties, "me");
        assertThatThrownBy(() -> service.enviar(List.of("a@b.com"), "assunto", "<p>x</p>"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Gmail API indisponível");
    }

    @Test
    void enviar_ativoFalse_lanca() {
        properties.setAtivo(false);
        NotificacaoEmailService service = new NotificacaoEmailService(gmailApiProvider, properties, "me");
        assertThatThrownBy(() -> service.enviar(List.of("a@b.com"), "assunto", "<p>x</p>"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("desativado");
        verifyNoInteractions(gmailApiProvider);
    }

    @Test
    void enviar_listaVazia_lanca() {
        NotificacaoEmailService service = new NotificacaoEmailService(gmailApiProvider, properties, "me");
        assertThatThrownBy(() -> service.enviar(List.of(), "assunto", "<p>x</p>"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void enviar_comGmail_enviaRawBcc() throws Exception {
        when(gmailApiProvider.resolver()).thenReturn(Optional.of(gmail));
        when(gmail.users()).thenReturn(users);
        when(users.getProfile("me")).thenReturn(profileGet);
        Profile profile = new Profile().setEmailAddress("monitor@oauth.com");
        when(profileGet.execute()).thenReturn(profile);
        when(users.messages()).thenReturn(messages);
        when(messages.send(eq("me"), any(Message.class))).thenReturn(send);
        when(send.execute()).thenReturn(new Message().setId("msg-1"));

        NotificacaoEmailService service = new NotificacaoEmailService(gmailApiProvider, properties, "me");
        service.enviar(
                List.of("dest1@test.com", "dest2@test.com"),
                "[Monitor] Nova movimentação — CNJ (Maria)",
                "<p>Movimentação <b>nova</b></p>");

        verify(gmailApiProvider).resolver();
        ArgumentCaptor<Message> cap = ArgumentCaptor.forClass(Message.class);
        verify(messages).send(eq("me"), cap.capture());
        byte[] decoded = Base64.getUrlDecoder().decode(cap.getValue().getRaw());
        String mime = new String(decoded);
        assertThat(mime)
                .contains("dest1@test.com", "dest2@test.com")
                .contains("Bcc:")
                .contains("Monitor Villa Real")
                .contains("monitor@oauth.com")
                .contains("Movimenta=C3=A7=C3=A3o");
    }

    @Test
    void enviar_falhaApi_propaga() throws Exception {
        when(gmailApiProvider.resolver()).thenReturn(Optional.of(gmail));
        when(gmail.users()).thenReturn(users);
        when(users.getProfile("me")).thenReturn(profileGet);
        when(profileGet.execute()).thenReturn(new Profile().setEmailAddress("m@o.com"));
        when(users.messages()).thenReturn(messages);
        when(messages.send(eq("me"), any())).thenReturn(send);
        when(send.execute()).thenThrow(new RuntimeException("quota"));

        NotificacaoEmailService service = new NotificacaoEmailService(gmailApiProvider, properties, "me");
        assertThatThrownBy(() -> service.enviar(List.of("a@b.com"), "assunto", "<p>x</p>"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("quota");
    }
}
