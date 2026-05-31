package br.com.vilareal.email;

import com.google.api.services.gmail.model.MessagePart;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

public final class GmailMimeUtil {

    private GmailMimeUtil() {}

    /**
     * Concatena todas as partes text/plain e text/html (ordem de aparição no MIME).
     * Necessário para emails Projudi em que o CNJ está no texto plano e o HTML é só casca.
     */
    static String extrairConteudoTextoCompleto(MessagePart payload) {
        if (payload == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        anexarPartesTexto(payload, sb);
        return sb.toString().trim();
    }

    private static void anexarPartesTexto(MessagePart parte, StringBuilder sb) {
        if (parte == null) {
            return;
        }
        String mime = parte.getMimeType() == null ? "" : parte.getMimeType().toLowerCase();
        if ("text/plain".equals(mime) || "text/html".equals(mime)) {
            String corpo = decodificarCorpo(parte);
            if (corpo != null && !corpo.isBlank()) {
                if (sb.length() > 0) {
                    sb.append("\n\n");
                }
                sb.append(corpo.trim());
            }
        }
        List<MessagePart> filhas = parte.getParts();
        if (filhas != null) {
            for (MessagePart filha : filhas) {
                anexarPartesTexto(filha, sb);
            }
        }
    }

    public static String extrairHtml(MessagePart payload) {
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
