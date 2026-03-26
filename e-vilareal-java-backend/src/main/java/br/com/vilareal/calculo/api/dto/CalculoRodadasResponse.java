package br.com.vilareal.calculo.api.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Map;

/** Mapa alinhado ao {@code vilareal.calculos.rodadas.v1} no front (localStorage). */
public record CalculoRodadasResponse(Map<String, JsonNode> rodadas) {}
