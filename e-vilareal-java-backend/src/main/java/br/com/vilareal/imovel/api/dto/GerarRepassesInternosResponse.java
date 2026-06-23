package br.com.vilareal.imovel.api.dto;

/**
 * Resultado da geração manual de repasses internos (imóvel próprio) para um contrato.
 */
public record GerarRepassesInternosResponse(
        Long contratoId,
        String competencia,
        int repassesGerados,
        int repassesJaExistentes,
        int alugueisSemRepasse) {}
