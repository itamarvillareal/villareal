package br.com.vilareal.notificacao.application;

import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Properties;

/** Montagem RFC 822 para envio via Gmail API (raw + Base64 URL-safe). */
final class NotificacaoEmailMimeBuilder {

    private NotificacaoEmailMimeBuilder() {}

    static byte[] buildMime(
            String remetenteEmail,
            String remetenteNome,
            List<String> destinatariosBcc,
            String assunto,
            String corpoHtml)
            throws Exception {
        if (!StringUtils.hasText(remetenteEmail)) {
            throw new IllegalArgumentException("E-mail do remetente OAuth ausente");
        }
        if (destinatariosBcc == null || destinatariosBcc.isEmpty()) {
            throw new IllegalArgumentException("Lista de destinatários BCC vazia");
        }

        Session session = Session.getInstance(new Properties());
        MimeMessage message = new MimeMessage(session);
        InternetAddress from = new InternetAddress(remetenteEmail.trim(), remetenteNome, "UTF-8");
        message.setFrom(from);
        for (String dest : destinatariosBcc) {
            if (StringUtils.hasText(dest)) {
                message.addRecipients(
                        jakarta.mail.Message.RecipientType.BCC, InternetAddress.parse(dest.trim()));
            }
        }
        message.setSubject(assunto, "UTF-8");
        message.setContent(corpoHtml != null ? corpoHtml : "", "text/html; charset=UTF-8");

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        message.writeTo(buffer);
        return buffer.toByteArray();
    }

    static String encodeRawUrlSafe(byte[] mimeBytes) {
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(mimeBytes);
    }
}
