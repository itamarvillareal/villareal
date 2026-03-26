package br.com.vilareal.calculo.api.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record CalculoClienteConfigResponse(JsonNode config) {}
