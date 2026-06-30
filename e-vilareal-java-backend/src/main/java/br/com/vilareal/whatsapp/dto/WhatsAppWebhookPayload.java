package br.com.vilareal.whatsapp.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Payload completo recebido no webhook da Meta (mensagens, status e metadados).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WhatsAppWebhookPayload(
        @JsonProperty("object") String object, @JsonProperty("entry") List<Entry> entry) {

    /**
     * Entrada do webhook associada a uma conta WABA.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Entry(
            @JsonProperty("id") String id, @JsonProperty("changes") List<Change> changes) {}

    /**
     * Alteração notificada (campo messages, message_template_status_update, etc.).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Change(@JsonProperty("value") Value value, @JsonProperty("field") String field) {}

    /**
     * Valor da alteração — mensagens recebidas, status de entrega e contatos.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Value(
            @JsonProperty("messaging_product") String messagingProduct,
            @JsonProperty("metadata") Metadata metadata,
            @JsonProperty("contacts") List<WebhookContact> contacts,
            @JsonProperty("messages") List<IncomingMessage> messages,
            @JsonProperty("statuses") List<MessageStatus> statuses) {}

    /**
     * Metadados do número de telefone business.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Metadata(
            @JsonProperty("display_phone_number") String displayPhoneNumber,
            @JsonProperty("phone_number_id") String phoneNumberId) {}

    /**
     * Contato que enviou a mensagem (perfil WhatsApp).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record WebhookContact(
            @JsonProperty("profile") Profile profile, @JsonProperty("wa_id") String waId) {}

    /**
     * Nome exibido no perfil WhatsApp do contato.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Profile(@JsonProperty("name") String name) {}

    /**
     * Mensagem recebida no webhook.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record IncomingMessage(
            @JsonProperty("from") String from,
            @JsonProperty("id") String id,
            @JsonProperty("timestamp") String timestamp,
            @JsonProperty("type") String type,
            @JsonProperty("text") TextContent text,
            @JsonProperty("image") MediaContent image,
            @JsonProperty("document") MediaContent document,
            @JsonProperty("audio") MediaContent audio,
            @JsonProperty("video") MediaContent video,
            @JsonProperty("sticker") MediaContent sticker) {}

    /**
     * Conteúdo textual de uma mensagem recebida.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TextContent(@JsonProperty("body") String body) {}

    /**
     * Metadados de mídia recebida (imagem, documento, áudio ou vídeo).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MediaContent(
            @JsonProperty("id") String mediaId,
            @JsonProperty("mime_type") String mimeType,
            @JsonProperty("sha256") String sha256,
            @JsonProperty("filename") String filename,
            @JsonProperty("caption") String caption) {}

    /**
     * Atualização de status de entrega/leitura de mensagem enviada.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MessageStatus(
            @JsonProperty("id") String id,
            @JsonProperty("status") String status,
            @JsonProperty("timestamp") String timestamp,
            @JsonProperty("recipient_id") String recipientId) {}
}
