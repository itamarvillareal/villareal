package br.com.vilareal.assinador.domain;

public enum AssinaturaLoteStatus {
    /** Preparo assíncrono (Drive → PENDENTE_ASSINATURA); assinador ainda não pode claim. */
    PREPARANDO,
    LIBERADO,
    EM_ASSINATURA,
    CONCLUIDO,
    ERRO,
    CANCELADO
}
