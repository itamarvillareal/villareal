package br.com.vilareal.whatsapp.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Requests JSON para envio de mídia via {@code POST /{phone-number-id}/messages}.
 * Campo {@code type} usa palavra-chave Meta (image/document/audio/video), não MIME.
 */
public final class WhatsAppMediaMessageRequests {

    private WhatsAppMediaMessageRequests() {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ImageMessageRequest(
            @JsonProperty("messaging_product") String messagingProduct,
            @JsonProperty("recipient_type") String recipientType,
            @JsonProperty("to") String to,
            @JsonProperty("type") String type,
            @JsonProperty("image") ImageBody image) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ImageBody(
            @JsonProperty("id") String id, @JsonProperty("caption") String caption) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record DocumentMessageRequest(
            @JsonProperty("messaging_product") String messagingProduct,
            @JsonProperty("recipient_type") String recipientType,
            @JsonProperty("to") String to,
            @JsonProperty("type") String type,
            @JsonProperty("document") DocumentBody document) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record DocumentBody(
            @JsonProperty("id") String id,
            @JsonProperty("filename") String filename,
            @JsonProperty("caption") String caption) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AudioMessageRequest(
            @JsonProperty("messaging_product") String messagingProduct,
            @JsonProperty("recipient_type") String recipientType,
            @JsonProperty("to") String to,
            @JsonProperty("type") String type,
            @JsonProperty("audio") AudioBody audio) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AudioBody(@JsonProperty("id") String id) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record VideoMessageRequest(
            @JsonProperty("messaging_product") String messagingProduct,
            @JsonProperty("recipient_type") String recipientType,
            @JsonProperty("to") String to,
            @JsonProperty("type") String type,
            @JsonProperty("video") VideoBody video) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record VideoBody(
            @JsonProperty("id") String id, @JsonProperty("caption") String caption) {}
}
