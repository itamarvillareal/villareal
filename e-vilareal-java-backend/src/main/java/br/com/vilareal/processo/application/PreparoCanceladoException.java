package br.com.vilareal.processo.application;

import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import br.com.vilareal.common.exception.BusinessRuleException;

/** Preparo assíncrono interrompido porque o lote deixou de estar {@link AssinaturaLoteStatus#PREPARANDO}. */
public class PreparoCanceladoException extends BusinessRuleException {

    private final Long loteId;
    private final AssinaturaLoteStatus statusObservado;

    public PreparoCanceladoException(Long loteId, AssinaturaLoteStatus statusObservado) {
        super(mensagem(loteId, statusObservado));
        this.loteId = loteId;
        this.statusObservado = statusObservado;
    }

    public Long loteId() {
        return loteId;
    }

    public AssinaturaLoteStatus statusObservado() {
        return statusObservado;
    }

    private static String mensagem(Long loteId, AssinaturaLoteStatus status) {
        String st = status != null ? status.name() : "desconhecido";
        return "Preparo cancelado (lote #" + loteId + ", status " + st + ").";
    }
}
