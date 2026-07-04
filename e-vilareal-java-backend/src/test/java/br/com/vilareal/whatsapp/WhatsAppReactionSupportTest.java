package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.ReactionContent;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppReactionSupportTest {

    @Test
    void toContentJson_serializaEmojiETarget() {
        String json = WhatsAppReactionSupport.toContentJson(new ReactionContent("wamid.alvo", "👍"));
        assertThat(json).contains("\"emoji\":\"👍\"");
        assertThat(json).contains("\"targetWaMessageId\":\"wamid.alvo\"");
    }

    @Test
    void toContentJson_retornaNullSemEmoji() {
        assertThat(WhatsAppReactionSupport.toContentJson(new ReactionContent("wamid.alvo", ""))).isNull();
        assertThat(WhatsAppReactionSupport.toContentJson(new ReactionContent("wamid.alvo", null))).isNull();
    }

    @Test
    void resumoLegivel_formataReagiu() {
        String json = WhatsAppReactionSupport.toContentJson(new ReactionContent("wamid.x", "❤️"));
        assertThat(WhatsAppReactionSupport.resumoLegivel(json)).isEqualTo("Reagiu ❤️");
    }
}
