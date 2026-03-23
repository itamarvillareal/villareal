package br.com.vilareal.api.monitoring.service;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class CnjFormatUtil {

    private static final Pattern CNJ = Pattern.compile(
            "(\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4})",
            Pattern.CASE_INSENSITIVE);

    private CnjFormatUtil() {
    }

    public static Optional<String> extractFirstCnj(String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        Matcher m = CNJ.matcher(text);
        if (m.find()) {
            return Optional.of(m.group(1).toUpperCase());
        }
        return Optional.empty();
    }
}
