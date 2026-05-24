package br.com.vilareal.whatsapp.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Request para envio de mensagem com template aprovado via WhatsApp Cloud API.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WhatsAppTemplateMessageRequest(
        @JsonProperty("messaging_product") String messagingProduct,
        @JsonProperty("to") String to,
        @JsonProperty("type") String type,
        @JsonProperty("template") Template template) {

    /**
     * Definição do template aprovado na Meta.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Template(
            @JsonProperty("name") String name,
            @JsonProperty("language") Language language,
            @JsonProperty("components") List<Component> components) {}

    /**
     * Idioma do template (ex.: pt_BR).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Language(@JsonProperty("code") String code) {}

    /**
     * Componente do template (header, body, button, etc.).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Component(
            @JsonProperty("type") String type,
            @JsonProperty("parameters") List<Parameter> parameters) {}

    /**
     * Parâmetro dinâmico de um componente do template.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Parameter(
            @JsonProperty("type") String type, @JsonProperty("text") String text) {}
}
