package br.com.vilareal.julia.application;

import br.com.vilareal.publicacao.application.event.PublicacaoVinculadaEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class JuliaTriagemAutoHook {

    private static final Logger log = LoggerFactory.getLogger(JuliaTriagemAutoHook.class);

    private final JuliaTriagemService juliaTriagemService;

    public JuliaTriagemAutoHook(JuliaTriagemService juliaTriagemService) {
        this.juliaTriagemService = juliaTriagemService;
    }

    @Async("juliaTriagemTaskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPublicacaoVinculada(PublicacaoVinculadaEvent event) {
        log.debug(
                "Julia auto-hook: publicacaoId={}, processoId={}",
                event.publicacaoId(),
                event.processoId());
        juliaTriagemService.triarPublicacaoSeElegivel(event.publicacaoId());
    }
}
