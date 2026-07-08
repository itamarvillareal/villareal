package br.com.vilareal.whatsapp.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request para revogar (apagar para todos) uma mensagem outbound via WhatsApp Cloud API.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WhatsAppRevokeMessageRequest(
        @JsonProperty("messaging_product") String messagingProduct,
        @JsonProperty("recipient_type") String recipientType,
        @JsonProperty("to") String to,
        @JsonProperty("type") String type,
        @JsonProperty("revoke") RevokeBody revoke) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RevokeBody(@JsonProperty("message_id") String messageId) {}
}
