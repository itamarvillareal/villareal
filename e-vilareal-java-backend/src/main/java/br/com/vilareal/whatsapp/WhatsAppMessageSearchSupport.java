package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppMessageDTO;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

public final class WhatsAppMessageSearchSupport {

    private static final Set<String> TEXT_TYPES = Set.of("TEXT", "TEMPLATE");
    private static final Set<String> MEDIA_CAPTION_TYPES = Set.of("IMAGE", "VIDEO", "DOCUMENT", "AUDIO");
    private static final Set<String> SKIPPED_TYPES =
            Set.of("REACTION", "CONTACT", "LOCATION", "INTERACTIVE", "BUTTON", "UNKNOWN");

    private WhatsAppMessageSearchSupport() {}

    public static boolean termoValido(String termo) {
        return StringUtils.hasText(termo) && termo.trim().length() >= 2;
    }

    public static boolean isSearchable(WhatsAppMessageDTO message) {
        if (message == null) {
            return false;
        }
        String type = String.valueOf(message.messageType()).trim().toUpperCase(Locale.ROOT);
        if (SKIPPED_TYPES.contains(type)) {
            return false;
        }
        if (TEXT_TYPES.contains(type)) {
            return StringUtils.hasText(message.content());
        }
        if (MEDIA_CAPTION_TYPES.contains(type)) {
            return StringUtils.hasText(message.content());
        }
        return false;
    }

    public static String textoBusca(WhatsAppMessageDTO message) {
        if (message == null || !StringUtils.hasText(message.content())) {
            return "";
        }
        String type = String.valueOf(message.messageType()).trim().toUpperCase(Locale.ROOT);
        if (TEXT_TYPES.contains(type) || MEDIA_CAPTION_TYPES.contains(type)) {
            return message.content().trim();
        }
        return "";
    }

    public static boolean matches(WhatsAppMessageDTO message, String termo) {
        if (!termoValido(termo) || !isSearchable(message)) {
            return false;
        }
        return normalizar(textoBusca(message)).contains(normalizar(termo.trim()));
    }

    static String normalizar(String texto) {
        if (!StringUtils.hasText(texto)) {
            return "";
        }
        String semAcentos =
                Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return semAcentos.toLowerCase(Locale.ROOT);
    }
}
