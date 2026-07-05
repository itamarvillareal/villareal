package br.com.vilareal.calculo.api.dto;

import java.util.List;

public record CalculoParcelamentosConsolidadoResponse(
        List<CalculoParcelamentoConsolidadoItem> itens,
        long total,
        CalculoParcelamentosConsolidadoResumo resumo) {}
