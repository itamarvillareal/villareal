package br.com.vilareal.whatsapp;

import org.springframework.util.StringUtils;

/**
 * Interpretação de {@code Range: bytes=} para resposta parcial (206) no proxy de mídia.
 */
public final class WhatsAppMediaRangeSupport {

    private WhatsAppMediaRangeSupport() {}

    public sealed interface Decision {
        /** Sem Range válido — responder corpo completo (200). */
        record FullBody() implements Decision {}

        /** Fatia solicitada (inclusiva). */
        record Partial(int start, int end) implements Decision {}

        /** Range inválido ou fora dos limites — 416. */
        record Unsatisfiable() implements Decision {}
    }

    public static Decision interpretar(String rangeHeader, int contentLength) {
        if (!StringUtils.hasText(rangeHeader)) {
            return new Decision.FullBody();
        }

        String trimmed = rangeHeader.trim();
        if (!trimmed.regionMatches(true, 0, "bytes=", 0, 6)) {
            return new Decision.Unsatisfiable();
        }

        String spec = trimmed.substring(6).trim();
        if (spec.contains(",")) {
            return new Decision.FullBody();
        }

        int dash = spec.indexOf('-');
        if (dash < 0) {
            return new Decision.Unsatisfiable();
        }

        String startPart = spec.substring(0, dash);
        String endPart = spec.substring(dash + 1);

        try {
            int start;
            int end;

            if (startPart.isEmpty()) {
                if (!StringUtils.hasText(endPart)) {
                    return new Decision.Unsatisfiable();
                }
                int suffixLength = Integer.parseInt(endPart);
                if (suffixLength <= 0 || contentLength <= 0) {
                    return new Decision.Unsatisfiable();
                }
                start = Math.max(0, contentLength - suffixLength);
                end = contentLength - 1;
            } else {
                start = Integer.parseInt(startPart);
                if (endPart.isEmpty()) {
                    end = contentLength - 1;
                } else {
                    end = Integer.parseInt(endPart);
                }
            }

            if (contentLength <= 0 || start < 0 || start >= contentLength) {
                return new Decision.Unsatisfiable();
            }
            if (end >= contentLength) {
                end = contentLength - 1;
            }
            if (start > end) {
                return new Decision.Unsatisfiable();
            }

            return new Decision.Partial(start, end);
        } catch (NumberFormatException e) {
            return new Decision.Unsatisfiable();
        }
    }
}
