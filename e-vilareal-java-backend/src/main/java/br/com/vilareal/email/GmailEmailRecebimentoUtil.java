package br.com.vilareal.email;

import com.google.api.services.gmail.model.Message;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;

/**
 * Data de recebimento do email no Gmail. O {@code internalDate} pode refletir a data da thread
 * (comum em PUSH TRT reutilizando conversa), não o horário real de chegada na caixa.
 * Usa o cabeçalho {@code Date} quando for mais recente que o {@code internalDate}.
 */
final class GmailEmailRecebimentoUtil {

    private static final ZoneId FUSO_BR = ZoneId.of("America/Sao_Paulo");

    private static final DateTimeFormatter[] DATE_HEADER_FORMATTERS = {
        DateTimeFormatter.RFC_1123_DATE_TIME.withLocale(Locale.ENGLISH),
        DateTimeFormatter.ofPattern("EEE, d MMM yyyy HH:mm:ss Z", Locale.ENGLISH),
        DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss Z", Locale.ENGLISH),
        DateTimeFormatter.ofPattern("d MMM yyyy HH:mm:ss Z", Locale.ENGLISH),
    };

    private GmailEmailRecebimentoUtil() {}

    static Instant extrairDataRecebimento(Message message) {
        Instant internal = extrairInternalDate(message);
        Instant header = extrairDateHeader(message);
        if (internal == null) {
            return header;
        }
        if (header == null) {
            return internal;
        }
        return header.isAfter(internal) ? header : internal;
    }

    private static Instant extrairInternalDate(Message message) {
        if (message == null) {
            return null;
        }
        Long ms = message.getInternalDate();
        if (ms == null || ms <= 0L) {
            return null;
        }
        return Instant.ofEpochMilli(ms);
    }

    private static Instant extrairDateHeader(Message message) {
        if (message == null || message.getPayload() == null || message.getPayload().getHeaders() == null) {
            return null;
        }
        String raw = message.getPayload().getHeaders().stream()
                .filter(h -> "Date".equalsIgnoreCase(h.getName()))
                .map(h -> h.getValue() == null ? "" : h.getValue().trim())
                .findFirst()
                .orElse("");
        return parseDateHeader(raw);
    }

    static Instant parseDateHeader(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String texto = raw.replaceAll("\\s+", " ").trim();
        String semDiaSemana = texto.replaceFirst("^[A-Za-z]{3},\\s+", "");
        for (String candidate : List.of(texto, semDiaSemana)) {
            for (DateTimeFormatter fmt : DATE_HEADER_FORMATTERS) {
                try {
                    return ZonedDateTime.parse(candidate, fmt).toInstant();
                } catch (DateTimeParseException ignored) {
                    // tenta próximo formato
                }
            }
        }
        return null;
    }

    static ZoneId fusoBrasil() {
        return FUSO_BR;
    }
}
