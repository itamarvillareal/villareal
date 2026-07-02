package br.com.vilareal.whatsapp;

import org.springframework.util.StringUtils;

import java.time.Instant;

/** Converte timestamps do webhook Meta (epoch segundos UTC) para {@link Instant}. */
public final class WhatsAppTimestampUtil {

    private WhatsAppTimestampUtil() {}

    /**
     * @param webhookTimestamp segundos Unix em UTC (campo {@code timestamp} da Meta)
     * @return instante correspondente ou {@link Instant#now()} se ausente/inválido
     */
    public static Instant fromWebhook(String webhookTimestamp) {
        if (!StringUtils.hasText(webhookTimestamp)) {
            return Instant.now();
        }
        try {
            long secs = Long.parseLong(webhookTimestamp.trim());
            if (secs <= 0) {
                return Instant.now();
            }
            return Instant.ofEpochSecond(secs);
        } catch (NumberFormatException e) {
            return Instant.now();
        }
    }
}
