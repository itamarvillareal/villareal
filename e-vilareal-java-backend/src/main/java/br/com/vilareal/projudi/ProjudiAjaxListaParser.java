package br.com.vilareal.projudi;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

/**
 * Parser defensivo das listas AJAX do PROJUDI ({@code desc1}/{@code id} ou variantes).
 */
public final class ProjudiAjaxListaParser {

    private ProjudiAjaxListaParser() {}

    public record CandidatoProjudi(int id, String label) {}

    public static List<CandidatoProjudi> parse(String jsonBody, ObjectMapper objectMapper) {
        List<CandidatoProjudi> out = new ArrayList<>();
        if (!StringUtils.hasText(jsonBody)) {
            return out;
        }
        try {
            JsonNode root = objectMapper.readTree(jsonBody.trim());
            if (root.isArray()) {
                for (JsonNode item : root) {
                    adicionarCandidato(out, item);
                }
            } else if (root.isObject()) {
                adicionarCandidato(out, root);
            }
        } catch (Exception ignored) {
            return List.of();
        }
        return out.stream().filter(c -> c.id() > 0).toList();
    }

    private static void adicionarCandidato(List<CandidatoProjudi> out, JsonNode item) {
        if (item == null || !item.isObject()) {
            return;
        }
        Integer id = extrairId(item);
        String label = extrairLabel(item);
        if (id == null || id <= 0 || !StringUtils.hasText(label)) {
            return;
        }
        out.add(new CandidatoProjudi(id, label.trim()));
    }

    private static Integer extrairId(JsonNode item) {
        for (String key : List.of("id", "Id", "ID", "codigo", "Codigo")) {
            if (item.has(key) && !item.get(key).isNull()) {
                String raw = item.get(key).asText("").trim();
                if (raw.matches("-?\\d+")) {
                    try {
                        return Integer.parseInt(raw);
                    } catch (NumberFormatException ignored) {
                        return null;
                    }
                }
            }
        }
        return null;
    }

    private static String extrairLabel(JsonNode item) {
        for (String key : List.of("desc1", "nome", "Nome", "label", "descricao", "Descricao")) {
            if (item.has(key) && !item.get(key).isNull()) {
                String t = item.get(key).asText("").trim();
                if (!t.isEmpty()) {
                    return t;
                }
            }
        }
        Iterator<String> fields = item.fieldNames();
        while (fields.hasNext()) {
            String key = fields.next();
            if (key.toLowerCase(Locale.ROOT).startsWith("desc") && item.get(key).isTextual()) {
                String t = item.get(key).asText("").trim();
                if (!t.isEmpty()) {
                    return t;
                }
            }
        }
        return "";
    }
}
