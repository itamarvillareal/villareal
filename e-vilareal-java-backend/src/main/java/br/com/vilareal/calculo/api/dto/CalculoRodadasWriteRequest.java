package br.com.vilareal.calculo.api.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record CalculoRodadasWriteRequest(@NotNull Map<String, JsonNode> rodadas) {}
