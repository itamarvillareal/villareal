package br.com.vilareal.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
public class ProjudiEmailScheduler {

    private static final Logger log = LoggerFactory.getLogger(ProjudiEmailScheduler.class);

    private final GmailProjudiManifestacaoService gmailProjudiManifestacaoService;

    public ProjudiEmailScheduler(
            @Autowired(required = false) GmailProjudiManifestacaoService gmailProjudiManifestacaoService) {
        this.gmailProjudiManifestacaoService = gmailProjudiManifestacaoService;
    }

    @Scheduled(fixedRate = 3, timeUnit = TimeUnit.HOURS)
    public void processarManifestacoesProjudiEmail() {
        if (gmailProjudiManifestacaoService == null || !gmailProjudiManifestacaoService.isDisponivel()) {
            log.debug("Scheduler Gmail Projudi ignorado: integração indisponível.");
            return;
        }
        log.info("Scheduler Gmail Projudi: início da execução.");
        try {
            PublicacaoEmailProcessamentoResumo resumo = gmailProjudiManifestacaoService.buscarEProcessarManifestacoes();
            log.info(
                    "Scheduler Gmail Projudi: fim — emailsLidos={}, manifestacoesProcessadas={}, erros={}",
                    resumo.getEmailsLidos(),
                    resumo.getPublicacoesProcessadas(),
                    resumo.getErros().size());
        } catch (Exception ex) {
            log.error("Scheduler Gmail Projudi: falha na execução.", ex);
        }
    }
}
