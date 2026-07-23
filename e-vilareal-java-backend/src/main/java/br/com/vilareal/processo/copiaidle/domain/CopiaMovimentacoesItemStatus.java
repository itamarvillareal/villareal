package br.com.vilareal.processo.copiaidle.domain;

public enum CopiaMovimentacoesItemStatus {
    /** Aguardando passagem no robô (ou ainda temMais). */
    PENDENTE,
    /** Acervo/cópia concluída (ou sem documentos a arquivar). */
    COMPLETO,
    /** Falha permanente após esgotar tentativas. */
    ERRO,
    /** Fora do escopo automático (autos físicos, sem CNJ, PJe sem automação). */
    IGNORADO
}
