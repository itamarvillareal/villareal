package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.ButtonContent;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.ButtonReply;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.InteractiveContent;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.ListReply;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppInteractiveReplySupportTest {

    @Test
    void toContentJson_buttonReply() {
        InteractiveContent interactive =
                new InteractiveContent("button_reply", new ButtonReply("opcao_1", "Sim, confirmo"), null);

        String json = WhatsAppInteractiveReplySupport.toContentJson(interactive);

        assertThat(json).contains("\"respostaInterativa\"");
        assertThat(json).contains("\"origem\":\"interactive\"");
        assertThat(json).contains("\"id\":\"opcao_1\"");
        assertThat(json).contains("\"title\":\"Sim, confirmo\"");
        assertThat(WhatsAppInteractiveReplySupport.resumoLegivel(json)).isEqualTo("↩️ Sim, confirmo");
    }

    @Test
    void toContentJson_listReply() {
        InteractiveContent interactive = new InteractiveContent(
                "list_reply", null, new ListReply("item_3", "Opção escolhida", "Detalhe opcional"));

        String json = WhatsAppInteractiveReplySupport.toContentJson(interactive);

        assertThat(json).contains("\"title\":\"Opção escolhida\"");
        assertThat(json).contains("\"description\":\"Detalhe opcional\"");
        assertThat(WhatsAppInteractiveReplySupport.resumoLegivel(json)).isEqualTo("↩️ Opção escolhida");
    }

    @Test
    void toContentJson_templateButton() {
        ButtonContent button = new ButtonContent("PAYLOAD_ID", "Texto do botão");

        String json = WhatsAppInteractiveReplySupport.toContentJson(button);

        assertThat(json).contains("\"origem\":\"button\"");
        assertThat(json).contains("\"payload\":\"PAYLOAD_ID\"");
        assertThat(json).contains("\"title\":\"Texto do botão\"");
        assertThat(WhatsAppInteractiveReplySupport.resumoLegivel(json)).isEqualTo("↩️ Texto do botão");
    }

    @Test
    void toContentJson_semTitulo_retornaNullOuResumoGenerico() {
        assertThat(WhatsAppInteractiveReplySupport.toContentJson((InteractiveContent) null))
                .isNull();
        assertThat(WhatsAppInteractiveReplySupport.toContentJson(new InteractiveContent("button_reply", null, null)))
                .isNull();
        assertThat(WhatsAppInteractiveReplySupport.resumoLegivel(null)).isEqualTo("↩️ Resposta");
        assertThat(WhatsAppInteractiveReplySupport.resumoLegivel("{}")).isEqualTo("↩️ Resposta");
    }
}
