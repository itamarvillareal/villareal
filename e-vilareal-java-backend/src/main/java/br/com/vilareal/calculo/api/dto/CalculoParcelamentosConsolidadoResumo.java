package br.com.vilareal.calculo.api.dto;

public record CalculoParcelamentosConsolidadoResumo(
        int totalItens,
        int vencidas,
        int aVencer,
        int pagas,
        int emAberto,
        int semExtrato,
        long valorVencidoCentavos,
        long valorEmAbertoCentavos) {}
