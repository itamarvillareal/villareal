package br.com.vilareal.iptu.application;

import br.com.vilareal.imovel.application.event.ContratoLocacaoAlteradoEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Runs IPTU recalculation in a <b>new transaction after commit</b> of the contract save, so side effects
 * only run if the contract transaction succeeded.
 */
@Component
public class IptuContratoRecalculoListener {

    private final IptuApplicationService iptuApplicationService;

    public IptuContratoRecalculoListener(IptuApplicationService iptuApplicationService) {
        this.iptuApplicationService = iptuApplicationService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onContratoAlterado(ContratoLocacaoAlteradoEvent event) {
        iptuApplicationService.recalcularPorContrato(event.contratoId());
    }
}
