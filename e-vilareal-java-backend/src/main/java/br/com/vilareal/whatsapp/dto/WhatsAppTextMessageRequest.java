package br.com.vilareal.whatsapp.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request para envio de mensagem de texto simples via WhatsApp Cloud API.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WhatsAppTextMessageRequest(
        @JsonProperty("messaging_product") String messagingProduct,
        @JsonProperty("recipient_type") String recipientType,
        @JsonProperty("to") String to,
        @JsonProperty("type") String type,
        @JsonProperty("text") TextBody text) {

    /**
     * Corpo da mensagem de texto.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TextBody(
            @JsonProperty("preview_url") Boolean previewUrl,
            @JsonProperty("body") String body) {}
}
