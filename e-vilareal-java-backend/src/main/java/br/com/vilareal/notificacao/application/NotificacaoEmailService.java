package br.com.vilareal.notificacao.application;

import br.com.vilareal.notificacao.config.NotificacaoEmailProperties;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * Envio best-effort de HTML via Gmail API (conta OAuth; destinatários em BCC).
 */
@Service
public class NotificacaoEmailService {

    private static final Logger log = LoggerFactory.getLogger(NotificacaoEmailService.class);

    private final ObjectProvider<Gmail> gmailProvider;
    private final NotificacaoEmailProperties properties;
    private final String gmailUser;

    public NotificacaoEmailService(
            ObjectProvider<Gmail> gmailProvider,
            NotificacaoEmailProperties properties,
            @Value("${gmail.user:me}") String gmailUser) {
        this.gmailProvider = gmailProvider;
        this.properties = properties;
        this.gmailUser = StringUtils.hasText(gmailUser) ? gmailUser.trim() : "me";
    }

    public boolean isDisponivel() {
        return gmailProvider.getIfAvailable() != null;
    }

    /**
     * Envia um único e-mail em BCC (não expõe destinatários entre si). Falhas só logam.
     */
    public void enviar(List<String> destinatarios, String assunto, String corpoHtml) {
        if (!properties.isAtivo()) {
            log.debug("Envio de e-mail do monitor desativado (vilareal.notificacao.email.ativo=false)");
            return;
        }
        if (destinatarios == null || destinatarios.isEmpty()) {
            log.debug("Envio de e-mail do monitor ignorado: lista de destinatários vazia");
            return;
        }
        Gmail gmail = gmailProvider.getIfAvailable();
        if (gmail == null) {
            log.warn("Gmail API indisponível — e-mail do monitor não enviado");
            return;
        }
        if (!StringUtils.hasText(assunto)) {
            log.warn("Assunto vazio — e-mail do monitor não enviado");
            return;
        }

        try {
            String remetenteEmail = obterEmailRemetenteOAuth(gmail);
            byte[] mime =
                    NotificacaoEmailMimeBuilder.buildMime(
                            remetenteEmail,
                            properties.getFromNome(),
                            destinatarios,
                            assunto,
                            corpoHtml);
            String raw = NotificacaoEmailMimeBuilder.encodeRawUrlSafe(mime);
            Message message = new Message();
            message.setRaw(raw);
            gmail.users().messages().send(gmailUser, message).execute();
            log.info(
                    "E-mail do monitor enviado via Gmail (BCC {} destinatário(s), assunto={})",
                    destinatarios.size(),
                    assunto);
        } catch (Exception e) {
            log.warn("Falha ao enviar e-mail do monitor via Gmail: {}", e.getMessage());
        }
    }

    private String obterEmailRemetenteOAuth(Gmail gmail) throws Exception {
        String email = gmail.users().getProfile(gmailUser).execute().getEmailAddress();
        if (!StringUtils.hasText(email)) {
            throw new IllegalStateException("Perfil Gmail sem endereço de e-mail");
        }
        return email.trim();
    }
}
