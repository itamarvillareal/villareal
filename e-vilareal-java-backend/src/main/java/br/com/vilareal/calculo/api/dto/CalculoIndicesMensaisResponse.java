package br.com.vilareal.calculo.api.dto;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Mesmas chaves {@code yyyy-MM} usadas em {@code monetaryIndicesService.js} no front.
 */
public record CalculoIndicesMensaisResponse(Map<String, BigDecimal> values) {}
