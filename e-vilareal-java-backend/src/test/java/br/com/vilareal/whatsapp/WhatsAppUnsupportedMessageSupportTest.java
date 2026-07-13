package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.UnsupportedContent;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.WebhookError;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.WebhookErrorData;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppUnsupportedMessageSupportTest {

    private static WebhookError erro(int code) {
        return new WebhookError(code, "titulo", "mensagem", new WebhookErrorData("detalhes"));
    }

    @Test
    void descricao_tipoConhecido_explicaOTipo() {
        String descricao = WhatsAppUnsupportedMessageSupport.descricao(
                List.of(erro(131051)), new UnsupportedContent("poll_creation"));
        assertThat(descricao).contains("enquete");
        assertThat(descricao).contains("não é suportado");
    }

    @Test
    void descricao_visualizacaoUnica_explicaOTipo() {
        String descricao = WhatsAppUnsupportedMessageSupport.descricao(
                List.of(erro(131051)), new UnsupportedContent("media_placeholder"));
        assertThat(descricao).contains("visualização única");
    }

    @Test
    void descricao_tipoDesconhecido_usaMensagemGenerica() {
        String descricao = WhatsAppUnsupportedMessageSupport.descricao(
                List.of(erro(131051)), new UnsupportedContent("algo_novo"));
        assertThat(descricao).contains("conteúdo não suportado");
        assertThat(descricao).contains("reenviar");
    }

    @Test
    void descricao_semUnsupported_usaMensagemGenerica() {
        String descricao = WhatsAppUnsupportedMessageSupport.descricao(List.of(erro(131051)), null);
        assertThat(descricao).contains("conteúdo não suportado");
    }

    @Test
    void descricao_erro131060_indicaIndisponibilidade() {
        String descricao = WhatsAppUnsupportedMessageSupport.descricao(List.of(erro(131060)), null);
        assertThat(descricao).contains("indisponível");
    }
}
