package br.com.vilareal.financeiro.domain;

/** Escopo da aplicação de um padrão recorrente no painel de análises. */
public enum EscopoAplicarRecorrencia {
    /** Pendentes N (IMPORTADO) + parciais a completar. */
    TODOS,
    /** Somente pendentes N (IMPORTADO). */
    NOVOS,
    /** Somente já classificados na conta dominante sem vínculo. */
    COMPLETAR
}
