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
public class PublicacaoEmailScheduler {

    private static final Logger log = LoggerFactory.getLogger(PublicacaoEmailScheduler.class);

    private final GmailPublicacaoService gmailPublicacaoService;
    private final JobRunTracker jobRunTracker;

    public PublicacaoEmailScheduler(
            @Autowired(required = false) GmailPublicacaoService gmailPublicacaoService,
            JobRunTracker jobRunTracker) {
        this.gmailPublicacaoService = gmailPublicacaoService;
        this.jobRunTracker = jobRunTracker;
    }

    @Scheduled(fixedRate = 3, timeUnit = TimeUnit.HOURS)
    public void processarPublicacoesEmail() {
        jobRunTracker.runTrackedJobVoid(JobNames.GMAIL_PUBLICACOES, ctx -> {
            if (gmailPublicacaoService == null || !gmailPublicacaoService.isDisponivel()) {
                log.debug("Scheduler Gmail publicações ignorado: integração indisponível.");
                ctx.putMetadata("skipped", "integracao_indisponivel");
                return;
            }
            log.info("Scheduler Gmail publicações: início da execução.");
            PublicacaoEmailProcessamentoResumo resumo;
            try {
                resumo = gmailPublicacaoService.buscarEProcessarPublicacoes();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            JobRunEmailResumoUtil.aplicarResumo(ctx, resumo);
            ctx.putMetadata("trigger", "scheduler");
            log.info(
                    "Scheduler Gmail publicações: fim — emailsLidos={}, publicacoesProcessadas={}, erros={}",
                    resumo.getEmailsLidos(),
                    resumo.getPublicacoesProcessadas(),
                    resumo.getErros().size());
        });
    }
}
