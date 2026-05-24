package br.com.vilareal.email;

import com.google.api.services.gmail.model.MessagePart;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

final class GmailMimeUtil {

    private GmailMimeUtil() {}

    static String extrairHtml(MessagePart payload) {
        if (payload == null) {
            return null;
        }
        String direto = lerParteHtml(payload);
        if (direto != null && !direto.isBlank()) {
            return direto;
        }
        List<MessagePart> partes = payload.getParts();
        if (partes == null) {
            return null;
        }
        String fallbackTexto = null;
        for (MessagePart parte : partes) {
            String html = extrairHtml(parte);
            if (html != null && !html.isBlank()) {
                return html;
            }
            if (fallbackTexto == null && "text/plain".equalsIgnoreCase(parte.getMimeType())) {
                String plain = decodificarCorpo(parte);
                if (plain != null && !plain.isBlank()) {
                    fallbackTexto = plain;
                }
            }
        }
        return fallbackTexto;
    }

    private static String lerParteHtml(MessagePart parte) {
        if ("text/html".equalsIgnoreCase(parte.getMimeType())) {
            return decodificarCorpo(parte);
        }
        return null;
    }

    private static String decodificarCorpo(MessagePart parte) {
        if (parte.getBody() == null || parte.getBody().getData() == null) {
            return null;
        }
        byte[] bytes = Base64.getUrlDecoder().decode(parte.getBody().getData());
        return new String(bytes, StandardCharsets.UTF_8);
    }
}
