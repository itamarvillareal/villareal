package br.com.vilareal.whatsapp.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Resposta de erro retornada pela Meta Graph API.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WhatsAppErrorResponse(@JsonProperty("error") ErrorDetail error) {

    /**
     * Detalhes do erro OAuth/API da Meta.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ErrorDetail(
            @JsonProperty("message") String message,
            @JsonProperty("type") String type,
            @JsonProperty("code") Integer code,
            @JsonProperty("error_subcode") Integer errorSubcode,
            @JsonProperty("fbtrace_id") String fbtraceId) {}
}
