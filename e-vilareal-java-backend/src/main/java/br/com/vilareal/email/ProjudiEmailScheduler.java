package br.com.vilareal.email;

import br.com.vilareal.jobrun.application.JobRunEmailResumoUtil;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;

/**
 * Importação Gmail PROJUDI periódica ({@code vilareal.email.gmail.importacao.intervalo-ms}, padrão 15 min).
 * Desligado quando o pipeline {@code vilareal.email.projudi.pipeline.enabled=true} assume o mesmo fluxo em loop.
 */
@Component
@ConditionalOnProperty(
        name = "vilareal.email.projudi.pipeline.enabled",
        havingValue = "false",
        matchIfMissing = true)
public class ProjudiEmailScheduler {

    private static final Logger log = LoggerFactory.getLogger(ProjudiEmailScheduler.class);

    private final GmailProjudiManifestacaoService gmailProjudiManifestacaoService;
    private final GmailCaixaOrdemService gmailCaixaOrdemService;
    private final JobRunTracker jobRunTracker;

    public ProjudiEmailScheduler(
            @Autowired(required = false) GmailProjudiManifestacaoService gmailProjudiManifestacaoService,
            @Autowired(required = false) GmailCaixaOrdemService gmailCaixaOrdemService,
            JobRunTracker jobRunTracker) {
        this.gmailProjudiManifestacaoService = gmailProjudiManifestacaoService;
        this.gmailCaixaOrdemService = gmailCaixaOrdemService;
        this.jobRunTracker = jobRunTracker;
    }

    @Scheduled(fixedDelayString = "${vilareal.email.gmail.importacao.intervalo-ms:900000}")
    public void processarManifestacoesProjudiEmail() {
        jobRunTracker.runTrackedJobVoid(JobNames.GMAIL_PROJUDI, ctx -> {
            if (gmailProjudiManifestacaoService == null || !gmailProjudiManifestacaoService.isDisponivel()) {
                log.debug("Scheduler Gmail Projudi ignorado: integração indisponível.");
                ctx.putMetadata("skipped", "integracao_indisponivel");
                return;
            }
            log.info("Scheduler Gmail Projudi: início da execução.");
            PublicacaoEmailProcessamentoResumo resumo;
            try {
                resumo = gmailProjudiManifestacaoService.buscarEProcessarManifestacoes();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            JobRunEmailResumoUtil.aplicarResumo(ctx, resumo);
            ctx.putMetadata("trigger", "scheduler");
            atualizarOrdemCaixa();
            log.info(
                    "Scheduler Gmail Projudi: fim — emailsLidos={}, manifestacoesProcessadas={}, erros={}",
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
            log.warn("Scheduler Gmail Projudi: falha ao atualizar ordem da caixa: {}", e.getMessage());
        }
    }
}
