package br.com.vilareal.whatsapp.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Resposta da Meta após upload de mídia ({@code POST /{phone-number-id}/media}).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WhatsAppMediaUploadResponse(@JsonProperty("id") String id) {}
