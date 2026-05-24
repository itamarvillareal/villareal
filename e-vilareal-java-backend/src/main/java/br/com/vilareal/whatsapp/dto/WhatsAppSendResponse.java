package br.com.vilareal.whatsapp.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Resposta da Meta após envio bem-sucedido de mensagem.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WhatsAppSendResponse(
        @JsonProperty("messaging_product") String messagingProduct,
        @JsonProperty("contacts") List<Contact> contacts,
        @JsonProperty("messages") List<Message> messages) {

    /**
     * Contato destinatário normalizado pela Meta.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Contact(
            @JsonProperty("input") String input, @JsonProperty("wa_id") String waId) {}

    /**
     * Mensagem aceita pela Meta (contém wamid).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Message(
            @JsonProperty("id") String id,
            @JsonProperty("message_status") String messageStatus) {}
}
