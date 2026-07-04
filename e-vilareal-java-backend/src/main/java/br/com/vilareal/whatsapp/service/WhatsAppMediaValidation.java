package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppMediaProperties;
import br.com.vilareal.whatsapp.WhatsAppMediaCategory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Set;

/**
 * Valida MIME e tamanho de arquivos outbound conforme limites da Meta.
 * MIME desconhecido → categoria document (fallback), respeitando teto de documento.
 */
@Component
public class WhatsAppMediaValidation {

    private static final Set<String> IMAGE_MIMES = Set.of("image/jpeg", "image/png");

    private static final Set<String> AUDIO_MIMES = Set.of(
            "audio/aac",
            "audio/mp4",
            "audio/mpeg",
            "audio/amr",
            "audio/ogg");

    private static final Set<String> VIDEO_MIMES = Set.of("video/mp4", "video/3gpp");

    /** Tipos explicitamente rejeitados mesmo como documento. */
    private static final Set<String> PROIBIDOS = Set.of(
            "application/x-msdownload",
            "application/x-executable",
            "application/vnd.microsoft.portable-executable",
            "application/x-sh",
            "application/x-bat",
            "application/x-msdos-program");

    private final WhatsAppMediaProperties properties;

    public WhatsAppMediaValidation(WhatsAppMediaProperties properties) {
        this.properties = properties;
    }

    public record ValidationResult(WhatsAppMediaCategory category, String normalizedMime) {}

    /**
     * @throws IllegalArgumentException se MIME proibido ou tamanho exceder limite da categoria
     */
    public ValidationResult validar(String mimeType, long sizeBytes) {
        if (sizeBytes < 0) {
            throw new IllegalArgumentException("Tamanho de arquivo inválido.");
        }
        String mime = normalizarMime(mimeType);
        if (PROIBIDOS.contains(mime)) {
            throw new IllegalArgumentException("Tipo de arquivo não permitido: " + mime);
        }

        WhatsAppMediaCategory category = resolverCategoria(mime);
        long limite = properties.getMaxBytes(category);
        if (sizeBytes > limite) {
            throw new IllegalArgumentException(
                    "Arquivo excede o limite de %s (%d MB). Tamanho: %.1f MB."
                            .formatted(
                                    category.name().toLowerCase(Locale.ROOT),
                                    limite / (1024 * 1024),
                                    sizeBytes / (1024.0 * 1024.0)));
        }
        return new ValidationResult(category, mime);
    }

    private static String normalizarMime(String mimeType) {
        if (!StringUtils.hasText(mimeType)) {
            return "application/octet-stream";
        }
        return mimeType.trim().toLowerCase(Locale.ROOT).split(";")[0].trim();
    }

    WhatsAppMediaCategory resolverCategoria(String normalizedMime) {
        if (IMAGE_MIMES.contains(normalizedMime)) {
            return WhatsAppMediaCategory.IMAGE;
        }
        if (AUDIO_MIMES.contains(normalizedMime)) {
            return WhatsAppMediaCategory.AUDIO;
        }
        if (VIDEO_MIMES.contains(normalizedMime)) {
            return WhatsAppMediaCategory.VIDEO;
        }
        return WhatsAppMediaCategory.DOCUMENT;
    }
}
