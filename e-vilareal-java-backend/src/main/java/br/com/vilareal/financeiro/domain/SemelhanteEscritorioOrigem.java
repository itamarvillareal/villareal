package br.com.vilareal.financeiro.domain;

/** Origem da sugestão na aba Escritório do Inbox Financeiro. */
public enum SemelhanteEscritorioOrigem {
    /** Mesma descrição normalizada + valor + banco já vinculados na Conta A. */
    HISTORICO,
    /** Parcela em Cálculos (parcelamento aceito): valor exato + data (vencimento ou D+1). */
    CALCULO_PARCELA,
    /** Nome de pessoa cadastrada (titular ou parte) aparece na descrição. */
    NOME_PESSOA
}
