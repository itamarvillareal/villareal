package br.com.vilareal.calculo.infrastructure.persistence.projection;

/**
 * Projeção leve para listagem de resumo — sem {@code payload_json}.
 */
public record CalculoRodadaResumoProjection(
        String codigoCliente, Integer numeroProcesso, Integer dimensao, boolean parcelamentoAceito) {}
