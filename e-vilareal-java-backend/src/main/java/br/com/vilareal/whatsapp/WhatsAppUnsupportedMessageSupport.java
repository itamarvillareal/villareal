package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.UnsupportedContent;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.WebhookError;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Gera descrição legível para mensagens que a Cloud API não entrega
 * (webhook {@code type=unsupported}, erros 131051/131060).
 *
 * <p>Nesses casos a Meta não fornece o conteúdo nem mídia para download —
 * o objetivo é explicar ao usuário por que a mensagem não pode ser aberta.
 */
public final class WhatsAppUnsupportedMessageSupport {

    /** Erro 131060: mensagem temporariamente indisponível (onboarding de número do app Business). */
    private static final int ERRO_MENSAGEM_INDISPONIVEL = 131060;

    private static final Map<String, String> ROTULOS_TIPO = Map.ofEntries(
            Map.entry("gif", "um GIF"),
            Map.entry("poll_creation", "uma enquete"),
            Map.entry("poll_update", "um voto em enquete"),
            Map.entry("edit", "uma edição de mensagem"),
            Map.entry("image", "uma imagem de visualização única"),
            Map.entry("media_placeholder", "uma mídia de visualização única"),
            Map.entry("keep_in_chat", "uma mensagem temporária"),
            Map.entry("pin", "uma mensagem fixada"),
            Map.entry("group_invite", "um convite de grupo"),
            Map.entry("order", "um pedido"),
            Map.entry("product", "um produto"),
            Map.entry("link_preview", "uma prévia de link"),
            Map.entry("list", "uma lista"),
            Map.entry("hsm", "um template"));

    private static final String ORIENTACAO_REENVIO =
            " Peça ao contato para reenviar como mensagem comum (foto, vídeo, áudio, documento ou texto).";

    private WhatsAppUnsupportedMessageSupport() {}

    public static String descricao(List<WebhookError> errors, UnsupportedContent unsupported) {
        if (contemErro(errors, ERRO_MENSAGEM_INDISPONIVEL)) {
            return "⚠️ Mensagem indisponível no momento — o WhatsApp não conseguiu entregá-la ao sistema."
                    + " Peça ao contato para reenviar.";
        }

        String tipo = unsupported != null ? unsupported.type() : null;
        String rotulo = StringUtils.hasText(tipo)
                ? ROTULOS_TIPO.get(tipo.trim().toLowerCase(Locale.ROOT))
                : null;
        if (rotulo != null) {
            return "🚫 O contato enviou " + rotulo + ", que não é suportado pelo WhatsApp Business."
                    + ORIENTACAO_REENVIO;
        }
        return "🚫 O contato enviou um conteúdo não suportado pelo WhatsApp Business"
                + " (ex.: visualização única ou enquete)." + ORIENTACAO_REENVIO;
    }

    private static boolean contemErro(List<WebhookError> errors, int codigo) {
        if (errors == null) {
            return false;
        }
        return errors.stream()
                .anyMatch(e -> e != null && e.code() != null && e.code() == codigo);
    }
}
