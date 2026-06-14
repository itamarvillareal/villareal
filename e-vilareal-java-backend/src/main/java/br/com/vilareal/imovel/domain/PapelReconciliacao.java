package br.com.vilareal.imovel.domain;

/**
 * Papel de um lançamento financeiro dentro de um ciclo de locação.
 * O resultado do escritório é calculado SOMENTE a partir do que foi vinculado com estes papéis.
 */
public enum PapelReconciliacao {
    /** Aluguel recebido do inquilino (entrada). */
    ALUGUEL,
    /** Repasse pago ao locador (saída). */
    REPASSE,
    /** Despesa do imóvel a abater no ciclo (saída). */
    DESPESA
}
