package br.com.vilareal.monitoramento.domain;

/** Situação de uma linha descoberta na varredura por CPF/CNPJ. */
public enum SituacaoProcessoDescoberto {
    /** Visto na primeira varredura completa — acervo pré-existente, sem alerta. */
    BASELINE,
    /** Descoberto após a baseline — aguarda triagem manual (cadastrar ou ignorar). */
    NOVO,
    /** Descartado (manualmente na UI, ou automático pela regra de polo). */
    IGNORADO,
    /** Casou com processo já cadastrado no acervo (dedupe por CNJ). */
    VINCULADO
}
