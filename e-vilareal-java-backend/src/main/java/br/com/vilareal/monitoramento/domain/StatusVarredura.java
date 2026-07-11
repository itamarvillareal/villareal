package br.com.vilareal.monitoramento.domain;

/** Status de uma execução de varredura de pessoa. */
public enum StatusVarredura {
    EXECUTANDO,
    SUCESSO,
    /** Limite de páginas por varredura atingido; continua na próxima execução. */
    PARCIAL,
    ERRO
}
