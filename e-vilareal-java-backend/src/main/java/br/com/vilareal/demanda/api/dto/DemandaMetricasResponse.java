package br.com.vilareal.demanda.api.dto;

import java.math.BigDecimal;

public record DemandaMetricasResponse(
        long cardsAtivos,
        BigDecimal totalValores,
        BigDecimal reembolsoPendente,
        long vencidos) {}
