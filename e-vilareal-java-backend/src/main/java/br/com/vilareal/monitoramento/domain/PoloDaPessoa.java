package br.com.vilareal.monitoramento.domain;

/**
 * Polo em que a pessoa monitorada figura num processo descoberto, inferido por comparação
 * de nome contra as células "Polo Ativo"/"Polo Passivo" da lista (o PROJUDI não marca qual
 * parte corresponde ao documento buscado).
 */
public enum PoloDaPessoa {
    ATIVO,
    PASSIVO,
    /** Nome casou nos dois polos. */
    AMBOS,
    /** Nome não casou em nenhum polo (ex.: razão social mudou) — nunca descartar automaticamente. */
    INDETERMINADO
}
