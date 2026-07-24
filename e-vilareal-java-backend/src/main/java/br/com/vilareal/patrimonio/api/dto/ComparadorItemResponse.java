package br.com.vilareal.patrimonio.api.dto;

import java.math.BigDecimal;

/** Item do comparador universal: ativos e dívidas na mesma métrica (% a.a. líquido). */
public record ComparadorItemResponse(
        String lado,
        String tipo,
        Long id,
        String nome,
        BigDecimal valor,
        BigDecimal taxaLiquidaAa,
        String observacao
) {
}
