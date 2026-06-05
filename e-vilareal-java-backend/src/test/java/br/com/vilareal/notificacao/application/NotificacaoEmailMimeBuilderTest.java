package br.com.vilareal.notificacao.application;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

class NotificacaoEmailMimeBuilderTest {

    @Test
    void buildMime_usaBccSemTo() throws Exception {
        byte[] raw = NotificacaoEmailMimeBuilder.buildMime(
                "monitor@villareal.com",
                "Monitor Villa Real",
                List.of("a@dest.com", "b@dest.com"),
                "[Monitor] Nova movimentação — CNJ (Cliente)",
                "<p>Corpo <strong>html</strong></p>");

        Session session = Session.getInstance(new Properties());
        MimeMessage parsed = new MimeMessage(session, new ByteArrayInputStream(raw));

        assertThat(parsed.getFrom()[0].toString()).contains("monitor@villareal.com");
        assertThat(parsed.getSubject()).contains("Nova movimentação");
        assertThat(parsed.getRecipients(MimeMessage.RecipientType.TO)).isNull();
        assertThat(parsed.getRecipients(MimeMessage.RecipientType.BCC)).hasSize(2);
        assertThat(parsed.getContent().toString()).contains("Corpo");
    }
}
