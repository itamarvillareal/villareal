package br.com.vilareal.config.jackson;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;

/**
 * Aceita ISO-8601 completo para {@link Instant} e também strings sem zona (ex. {@code 2026-05-15T12:00:00}),
 * que o Jackson padrão rejeita. Datas «locais» usam {@link ZoneId#systemDefault()} quando não é UTC puro;
 * caso contrário {@code America/Sao_Paulo}.
 */
public class LenientInstantDeserializer extends JsonDeserializer<Instant> {

    private static final ZoneId FALLBACK_ZONE = ZoneId.of("America/Sao_Paulo");

    @Override
    public Instant deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        JsonToken token = p.currentToken();
        if (token == JsonToken.VALUE_NULL) {
            return null;
        }
        if (token == JsonToken.VALUE_NUMBER_INT || token == JsonToken.VALUE_NUMBER_FLOAT) {
            return Instant.ofEpochMilli(p.getLongValue());
        }

        String text = p.getValueAsString();
        if (text == null || text.isBlank()) {
            return null;
        }
        text = text.trim();

        try {
            return Instant.parse(text);
        } catch (DateTimeParseException ignored) {
            // segue
        }
        try {
            return OffsetDateTime.parse(text).toInstant();
        } catch (DateTimeParseException ignored) {
            // segue
        }
        try {
            return ZonedDateTime.parse(text).toInstant();
        } catch (DateTimeParseException ignored) {
            // segue
        }
        try {
            LocalDateTime ldt = LocalDateTime.parse(text);
            return ldt.atZone(zonePreferida()).toInstant();
        } catch (DateTimeParseException ignored) {
            // segue
        }
        try {
            LocalDate ld = LocalDate.parse(text);
            return ld.atStartOfDay(zonePreferida()).toInstant();
        } catch (DateTimeParseException ignored) {
            throw ctxt.weirdStringException(text, Instant.class, "Instant — formato não reconhecido");
        }
    }

    private static ZoneId zonePreferida() {
        ZoneId sys = ZoneId.systemDefault();
        if (sys != null && !sys.equals(ZoneId.of("UTC"))) {
            return sys;
        }
        return FALLBACK_ZONE;
    }
}
