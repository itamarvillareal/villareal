package br.com.vilareal.assinador.api.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record AssinadorConcluirResponse(
        Long loteId, String status, int pareadas, int totalEnviados, JsonNode detalhes) {}
