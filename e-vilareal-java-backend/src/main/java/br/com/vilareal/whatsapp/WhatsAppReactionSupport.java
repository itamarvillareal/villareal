package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.ReactionContent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Serializa reação recebida no webhook WhatsApp para JSON em {@code content}.
 *
 * <p>Remoção de reação (emoji vazio na Meta) é ignorada no webhook — não persiste linha na thread.
 */
public final class WhatsAppReactionSupport {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private WhatsAppReactionSupport() {}

    public static String toContentJson(ReactionContent reaction) {
        if (reaction == null || !StringUtils.hasText(reaction.emoji())) {
            return null;
        }
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("emoji", reaction.emoji().trim());
        if (StringUtils.hasText(reaction.messageId())) {
            item.put("targetWaMessageId", reaction.messageId().trim());
        }
        try {
            return MAPPER.writeValueAsString(Map.of("reacao", item));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Falha ao serializar reação WhatsApp", e);
        }
    }

    public static String resumoLegivel(String contentJson) {
        if (!StringUtils.hasText(contentJson)) {
            return "Reação";
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> root = MAPPER.readValue(contentJson, Map.class);
            Object raw = root.get("reacao");
            if (!(raw instanceof Map<?, ?> reacao)) {
                return "Reação";
            }
            Object emoji = reacao.get("emoji");
            if (emoji != null && StringUtils.hasText(String.valueOf(emoji))) {
                return "Reagiu " + String.valueOf(emoji).trim();
            }
            return "Reação";
        } catch (Exception e) {
            return "Reação";
        }
    }
}
