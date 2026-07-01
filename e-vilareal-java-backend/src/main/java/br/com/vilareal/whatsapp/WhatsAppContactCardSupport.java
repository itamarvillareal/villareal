package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.SharedContact;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.SharedContactEmail;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.SharedContactName;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.SharedContactPhone;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Serializa cartões de contato recebidos no webhook WhatsApp para JSON em {@code content}. */
public final class WhatsAppContactCardSupport {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private WhatsAppContactCardSupport() {}

    public static String toContentJson(List<SharedContact> contacts) {
        if (contacts == null || contacts.isEmpty()) {
            return null;
        }
        List<Map<String, Object>> contatos = new ArrayList<>();
        for (SharedContact contact : contacts) {
            if (contact == null) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("nome", extrairNome(contact.name()));
            List<Map<String, String>> telefones = extrairTelefones(contact.phones());
            if (!telefones.isEmpty()) {
                item.put("telefones", telefones);
            }
            List<String> emails = extrairEmails(contact.emails());
            if (!emails.isEmpty()) {
                item.put("emails", emails);
            }
            if (!item.isEmpty()) {
                contatos.add(item);
            }
        }
        if (contatos.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(Map.of("contatos", contatos));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Falha ao serializar cartão de contato WhatsApp", e);
        }
    }

    public static String resumoLegivel(String contentJson) {
        if (!StringUtils.hasText(contentJson)) {
            return "Cartão de contato";
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> root = MAPPER.readValue(contentJson, Map.class);
            Object raw = root.get("contatos");
            if (!(raw instanceof List<?> list) || list.isEmpty()) {
                return "Cartão de contato";
            }
            List<String> nomes = new ArrayList<>();
            for (Object o : list) {
                if (o instanceof Map<?, ?> m) {
                    Object nome = m.get("nome");
                    if (nome != null && StringUtils.hasText(String.valueOf(nome))) {
                        nomes.add(String.valueOf(nome).trim());
                    }
                }
            }
            if (nomes.isEmpty()) {
                return "Cartão de contato";
            }
            if (nomes.size() == 1) {
                return "Cartão de contato: " + nomes.getFirst();
            }
            return "Cartão de contato: " + nomes.getFirst() + " (+" + (nomes.size() - 1) + ")";
        } catch (Exception e) {
            return "Cartão de contato";
        }
    }

    private static String extrairNome(SharedContactName name) {
        if (name == null) {
            return "";
        }
        if (StringUtils.hasText(name.formattedName())) {
            return name.formattedName().trim();
        }
        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(name.firstName())) {
            sb.append(name.firstName().trim());
        }
        if (StringUtils.hasText(name.lastName())) {
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(name.lastName().trim());
        }
        return sb.toString().trim();
    }

    private static List<Map<String, String>> extrairTelefones(List<SharedContactPhone> phones) {
        List<Map<String, String>> out = new ArrayList<>();
        if (phones == null) {
            return out;
        }
        for (SharedContactPhone phone : phones) {
            if (phone == null) {
                continue;
            }
            String display = StringUtils.hasText(phone.phone()) ? phone.phone().trim() : null;
            String waId = StringUtils.hasText(phone.waId()) ? phone.waId().trim() : null;
            if (!StringUtils.hasText(display) && !StringUtils.hasText(waId)) {
                continue;
            }
            Map<String, String> row = new LinkedHashMap<>();
            if (StringUtils.hasText(display)) {
                row.put("numero", display);
            }
            if (StringUtils.hasText(waId)) {
                row.put("waId", waId);
            }
            if (StringUtils.hasText(phone.type())) {
                row.put("tipo", phone.type().trim());
            }
            out.add(row);
        }
        return out;
    }

    private static List<String> extrairEmails(List<SharedContactEmail> emails) {
        List<String> out = new ArrayList<>();
        if (emails == null) {
            return out;
        }
        for (SharedContactEmail email : emails) {
            if (email != null && StringUtils.hasText(email.email())) {
                out.add(email.email().trim());
            }
        }
        return out;
    }
}
