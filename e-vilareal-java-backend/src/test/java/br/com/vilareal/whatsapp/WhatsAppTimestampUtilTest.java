package br.com.vilareal.whatsapp;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppTimestampUtilTest {

    @Test
    void fromWebhook_converteSegundosUtc() {
        Instant expected = Instant.parse("2026-07-02T12:04:10Z");
        long secs = expected.getEpochSecond();
        assertThat(WhatsAppTimestampUtil.fromWebhook(String.valueOf(secs))).isEqualTo(expected);
    }

    @Test
    void fromWebhook_retornaNowQuandoInvalido() {
        Instant before = Instant.now();
        Instant parsed = WhatsAppTimestampUtil.fromWebhook("nao-numero");
        Instant after = Instant.now();
        assertThat(parsed).isAfterOrEqualTo(before).isBeforeOrEqualTo(after);
    }
}
