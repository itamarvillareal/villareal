package br.com.vilareal.imovel.domain;

/** Situação do repasse de um ciclo, derivada exclusivamente dos vínculos com o caixa. */
public enum StatusRepasse {
    /** Há repasse vinculado e ele bate com o esperado (recebido − taxa esperada − despesas). */
    FEITO,
    /** Não há repasse vinculado na competência. */
    PENDENTE,
    /** Há repasse, mas diverge do esperado. */
    DIVERGENTE
}
