package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.ButtonContent;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.ButtonReply;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.InteractiveContent;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.ListReply;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.Map;

/** Serializa respostas interativas (menu/botão) recebidas no webhook WhatsApp para JSON em {@code content}. */
public final class WhatsAppInteractiveReplySupport {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private WhatsAppInteractiveReplySupport() {}

    public static String toContentJson(InteractiveContent interactive) {
        if (interactive == null) {
            return null;
        }
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("origem", "interactive");

        ButtonReply buttonReply = interactive.buttonReply();
        if (buttonReply != null) {
            if (StringUtils.hasText(buttonReply.id())) {
                item.put("id", buttonReply.id().trim());
            }
            if (StringUtils.hasText(buttonReply.title())) {
                item.put("title", buttonReply.title().trim());
            }
        }

        ListReply listReply = interactive.listReply();
        if (listReply != null) {
            if (StringUtils.hasText(listReply.id())) {
                item.put("id", listReply.id().trim());
            }
            if (StringUtils.hasText(listReply.title())) {
                item.put("title", listReply.title().trim());
            }
            if (StringUtils.hasText(listReply.description())) {
                item.put("description", listReply.description().trim());
            }
        }

        if (!item.containsKey("title") && !item.containsKey("id")) {
            return null;
        }
        return serializar(item);
    }

    public static String toContentJson(ButtonContent button) {
        if (button == null) {
            return null;
        }
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("origem", "button");
        if (StringUtils.hasText(button.payload())) {
            item.put("payload", button.payload().trim());
        }
        if (StringUtils.hasText(button.text())) {
            item.put("title", button.text().trim());
        }
        if (!item.containsKey("title") && !item.containsKey("payload")) {
            return null;
        }
        return serializar(item);
    }

    public static String resumoLegivel(String contentJson) {
        if (!StringUtils.hasText(contentJson)) {
            return "↩️ Resposta";
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> root = MAPPER.readValue(contentJson, Map.class);
            Object raw = root.get("respostaInterativa");
            if (!(raw instanceof Map<?, ?> reply)) {
                return "↩️ Resposta";
            }
            Object title = reply.get("title");
            if (title != null && StringUtils.hasText(String.valueOf(title))) {
                return "↩️ " + String.valueOf(title).trim();
            }
            return "↩️ Resposta";
        } catch (Exception e) {
            return "↩️ Resposta";
        }
    }

    private static String serializar(Map<String, Object> item) {
        try {
            return MAPPER.writeValueAsString(Map.of("respostaInterativa", item));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Falha ao serializar resposta interativa WhatsApp", e);
        }
    }
}
