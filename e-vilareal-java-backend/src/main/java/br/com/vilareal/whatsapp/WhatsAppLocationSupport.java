package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.LocationContent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.Map;

/** Serializa localização recebida no webhook WhatsApp para JSON em {@code content}. */
public final class WhatsAppLocationSupport {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private WhatsAppLocationSupport() {}

    public static String toContentJson(LocationContent location) {
        if (location == null) {
            return null;
        }
        if (location.latitude() == null || location.longitude() == null) {
            return null;
        }
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("latitude", location.latitude());
        item.put("longitude", location.longitude());
        if (StringUtils.hasText(location.name())) {
            item.put("name", location.name().trim());
        }
        if (StringUtils.hasText(location.address())) {
            item.put("address", location.address().trim());
        }
        try {
            return MAPPER.writeValueAsString(Map.of("localizacao", item));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Falha ao serializar localização WhatsApp", e);
        }
    }

    public static String resumoLegivel(String contentJson) {
        if (!StringUtils.hasText(contentJson)) {
            return "📍 Localização";
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> root = MAPPER.readValue(contentJson, Map.class);
            Object raw = root.get("localizacao");
            if (!(raw instanceof Map<?, ?> loc)) {
                return "📍 Localização";
            }
            Object name = loc.get("name");
            if (name != null && StringUtils.hasText(String.valueOf(name))) {
                return "📍 " + String.valueOf(name).trim();
            }
            return "📍 Localização";
        } catch (Exception e) {
            return "📍 Localização";
        }
    }
}
