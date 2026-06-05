package br.com.vilareal.notificacao.application;

import br.com.vilareal.email.GmailApiProvider;
import br.com.vilareal.notificacao.config.NotificacaoEmailProperties;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * Envio de HTML via Gmail API (conta OAuth; destinatários em BCC).
 */
@Service
public class NotificacaoEmailService {

    private static final Logger log = LoggerFactory.getLogger(NotificacaoEmailService.class);

    private final GmailApiProvider gmailApiProvider;
    private final NotificacaoEmailProperties properties;
    private final String gmailUser;

    public NotificacaoEmailService(
            GmailApiProvider gmailApiProvider,
            NotificacaoEmailProperties properties,
            @Value("${gmail.user:me}") String gmailUser) {
        this.gmailApiProvider = gmailApiProvider;
        this.properties = properties;
        this.gmailUser = StringUtils.hasText(gmailUser) ? gmailUser.trim() : "me";
    }

    public boolean isDisponivel() {
        return gmailApiProvider.isDisponivel();
    }

    /**
     * Envia um único e-mail em BCC. Lança exceção em falha para o chamador registrar o resultado.
     */
    public void enviar(List<String> destinatarios, String assunto, String corpoHtml) throws Exception {
        if (!properties.isAtivo()) {
            throw new IllegalStateException("Envio de e-mail do monitor desativado (vilareal.notificacao.email.ativo=false)");
        }
        if (destinatarios == null || destinatarios.isEmpty()) {
            throw new IllegalArgumentException("Lista de destinatários vazia");
        }
        Gmail gmail = gmailApiProvider
                .resolver()
                .orElseThrow(() -> new IllegalStateException("Gmail API indisponível"));
        if (!StringUtils.hasText(assunto)) {
            throw new IllegalArgumentException("Assunto vazio");
        }

        String remetenteEmail = obterEmailRemetenteOAuth(gmail);
        byte[] mime =
                NotificacaoEmailMimeBuilder.buildMime(
                        remetenteEmail, properties.getFromNome(), destinatarios, assunto, corpoHtml);
        String raw = NotificacaoEmailMimeBuilder.encodeRawUrlSafe(mime);
        Message message = new Message();
        message.setRaw(raw);
        gmail.users().messages().send(gmailUser, message).execute();
        log.info(
                "E-mail do monitor enviado via Gmail (BCC {} destinatário(s), assunto={})",
                destinatarios.size(),
                assunto);
    }

    private String obterEmailRemetenteOAuth(Gmail gmail) throws Exception {
        String email = gmail.users().getProfile(gmailUser).execute().getEmailAddress();
        if (!StringUtils.hasText(email)) {
            throw new IllegalStateException("Perfil Gmail sem endereço de e-mail");
        }
        return email.trim();
    }
}
