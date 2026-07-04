package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppMessageDTO;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppMessageSearchSupportTest {

    @Test
    void termoValido_rejeitaCurtoOuVazio() {
        assertThat(WhatsAppMessageSearchSupport.termoValido(null)).isFalse();
        assertThat(WhatsAppMessageSearchSupport.termoValido("")).isFalse();
        assertThat(WhatsAppMessageSearchSupport.termoValido(" ")).isFalse();
        assertThat(WhatsAppMessageSearchSupport.termoValido("a")).isFalse();
        assertThat(WhatsAppMessageSearchSupport.termoValido("ab")).isTrue();
    }

    @Test
    void matches_encontraTextoCaseInsensitiveSemAcento() {
        WhatsAppMessageDTO msg = message("TEXT", "Pagamento confirmado para João");
        assertThat(WhatsAppMessageSearchSupport.matches(msg, "joao")).isTrue();
        assertThat(WhatsAppMessageSearchSupport.matches(msg, "PAGAMENTO")).isTrue();
        assertThat(WhatsAppMessageSearchSupport.matches(msg, "inexistente")).isFalse();
    }

    @Test
    void matches_encontraLegendaMidia() {
        WhatsAppMessageDTO msg = message("IMAGE", "Foto do comprovante bancário");
        assertThat(WhatsAppMessageSearchSupport.matches(msg, "comprovante")).isTrue();
        assertThat(WhatsAppMessageSearchSupport.matches(msg, "bancario")).isTrue();
    }

    @Test
    void matches_ignoraReaction() {
        WhatsAppMessageDTO msg = message("REACTION", "👍");
        assertThat(WhatsAppMessageSearchSupport.matches(msg, "👍")).isFalse();
    }

    @Test
    void matches_ignoraContactLocationInteractive() {
        assertThat(WhatsAppMessageSearchSupport.matches(message("CONTACT", "Maria Silva"), "Maria")).isFalse();
        assertThat(WhatsAppMessageSearchSupport.matches(message("LOCATION", "-16.0,-49.0"), "16")).isFalse();
        assertThat(WhatsAppMessageSearchSupport.matches(message("INTERACTIVE", "{\"title\":\"Sim\"}"), "Sim")).isFalse();
    }

    private static WhatsAppMessageDTO message(String type, String content) {
        return new WhatsAppMessageDTO(
                1L,
                "wamid.test",
                "5562999999999",
                "Contato",
                "INBOUND",
                type,
                content,
                null,
                "DELIVERED",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                Instant.parse("2026-06-29T12:00:00Z"));
    }
}
