package br.com.vilareal.financeiro.domain;

public enum OrigemSugestao {
    REGRA,
    /** Depósito anterior da mesma pessoa (CPF na descrição) já classificado em conta A. */
    DEPOSITO_IDENTIFICADO,
    /** Pessoa no cadastro com vínculo a código cliente + proc. */
    PESSOA_PROCESSO,
    HISTORICO,
    RECORRENCIA
}
