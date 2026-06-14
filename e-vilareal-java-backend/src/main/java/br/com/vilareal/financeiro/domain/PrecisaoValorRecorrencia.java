package br.com.vilareal.financeiro.domain;

/** Precisão de valor na listagem/aplicação de padrões recorrentes. */
public enum PrecisaoValorRecorrencia {
    /** Somente candidatos com valor idêntico ao modal (2 casas). */
    EXATO,
    /** Somente candidatos dentro de ±5% do modal. */
    APROXIMADO,
    /** Exatos + aproximados (nunca divergentes). */
    TODOS,
    /** Ignora valor — todos os candidatos do padrão (descricao_norm + banco). */
    IGNORAR_VALOR;

    public boolean incluiExatos() {
        return this == EXATO || this == TODOS;
    }

    public boolean incluiAproximados() {
        return this == APROXIMADO || this == TODOS;
    }

    public boolean ignoraValor() {
        return this == IGNORAR_VALOR;
    }
}
