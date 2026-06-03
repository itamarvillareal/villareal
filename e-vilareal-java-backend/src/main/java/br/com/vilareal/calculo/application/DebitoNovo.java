package br.com.vilareal.calculo.application;

/**
 * Débito candidato a inserção em rodada de cálculo (inadimplência / merge recorrente).
 */
public record DebitoNovo(String vencimento, long valorCentavos, String descricao) {}
