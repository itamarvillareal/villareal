package br.com.vilareal.calculo.api.dto;

/** Metadados leves de uma rodada (sem {@code payload_json} completo). */
public record CalculoRodadaResumoItem(String chave, boolean parcelamentoAceito) {}
