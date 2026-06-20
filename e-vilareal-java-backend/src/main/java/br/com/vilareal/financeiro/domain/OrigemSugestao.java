package br.com.vilareal.financeiro.domain;

public enum OrigemSugestao {
    REGRA,
    /** Depósito anterior da mesma pessoa (CPF na descrição) já classificado em conta A. */
    DEPOSITO_IDENTIFICADO,
    /** Pessoa no cadastro com vínculo a código cliente + proc. */
    PESSOA_PROCESSO,
    HISTORICO,
    /** Mesma descrição já classificada em lançamentos posteriores (fallback). */
    HISTORICO_POSTERIOR,
    RECORRENCIA,
    /** Recorrência inferida de lançamentos posteriores (fallback). */
    RECORRENCIA_POSTERIOR,
    /** Mesmo estabelecimento (nome), valor divergente — preferir sugerir a omitir. */
    RECORRENCIA_NOME
}
