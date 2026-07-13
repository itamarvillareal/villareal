package br.com.vilareal.email;

import br.com.vilareal.jobrun.application.JobRunEmailResumoUtil;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.concurrent.TimeUnit;

@Component
public class TrtPushEmailScheduler {

    private static final Logger log = LoggerFactory.getLogger(TrtPushEmailScheduler.class);

    private final GmailTrtPushManifestacaoService gmailTrtPushManifestacaoService;
    private final GmailCaixaOrdemService gmailCaixaOrdemService;
    private final JobRunTracker jobRunTracker;

    public TrtPushEmailScheduler(
            @Autowired(required = false) GmailTrtPushManifestacaoService gmailTrtPushManifestacaoService,
            @Autowired(required = false) GmailCaixaOrdemService gmailCaixaOrdemService,
            JobRunTracker jobRunTracker) {
        this.gmailTrtPushManifestacaoService = gmailTrtPushManifestacaoService;
        this.gmailCaixaOrdemService = gmailCaixaOrdemService;
        this.jobRunTracker = jobRunTracker;
    }

    @Scheduled(fixedRate = 3, timeUnit = TimeUnit.HOURS)
    public void processarMovimentacoesTrtEmail() {
        jobRunTracker.runTrackedJobVoid(JobNames.GMAIL_TRT, ctx -> {
            if (gmailTrtPushManifestacaoService == null || !gmailTrtPushManifestacaoService.isDisponivel()) {
                log.debug("Scheduler Gmail TRT ignorado: integração indisponível.");
                ctx.putMetadata("skipped", "integracao_indisponivel");
                return;
            }
            log.info("Scheduler Gmail TRT: início da execução.");
            PublicacaoEmailProcessamentoResumo resumo;
            try {
                resumo = gmailTrtPushManifestacaoService.buscarEProcessarManifestacoes();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            JobRunEmailResumoUtil.aplicarResumo(ctx, resumo);
            ctx.putMetadata("trigger", "scheduler");
            atualizarOrdemCaixa();
            log.info(
                    "Scheduler Gmail TRT: fim — emailsLidos={}, movimentacoesProcessadas={}, erros={}",
                    resumo.getEmailsLidos(),
                    resumo.getPublicacoesProcessadas(),
                    resumo.getErros().size());
        });
    }

    /** Sem ordem da caixa a tela oculta publicações recém-importadas. */
    private void atualizarOrdemCaixa() {
        if (gmailCaixaOrdemService == null) {
            return;
        }
        try {
            gmailCaixaOrdemService.atualizarOrdemCaixaInbox();
        } catch (Exception e) {
            log.warn("Scheduler Gmail TRT: falha ao atualizar ordem da caixa: {}", e.getMessage());
        }
    }
}
