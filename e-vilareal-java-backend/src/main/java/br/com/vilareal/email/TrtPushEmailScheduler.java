package br.com.vilareal.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
public class TrtPushEmailScheduler {

    private static final Logger log = LoggerFactory.getLogger(TrtPushEmailScheduler.class);

    private final GmailTrtPushManifestacaoService gmailTrtPushManifestacaoService;

    public TrtPushEmailScheduler(
            @Autowired(required = false) GmailTrtPushManifestacaoService gmailTrtPushManifestacaoService) {
        this.gmailTrtPushManifestacaoService = gmailTrtPushManifestacaoService;
    }

    @Scheduled(fixedRate = 3, timeUnit = TimeUnit.HOURS)
    public void processarMovimentacoesTrtEmail() {
        if (gmailTrtPushManifestacaoService == null || !gmailTrtPushManifestacaoService.isDisponivel()) {
            log.debug("Scheduler Gmail TRT ignorado: integração indisponível.");
            return;
        }
        log.info("Scheduler Gmail TRT: início da execução.");
        try {
            PublicacaoEmailProcessamentoResumo resumo = gmailTrtPushManifestacaoService.buscarEProcessarManifestacoes();
            log.info(
                    "Scheduler Gmail TRT: fim — emailsLidos={}, movimentacoesProcessadas={}, erros={}",
                    resumo.getEmailsLidos(),
                    resumo.getPublicacoesProcessadas(),
                    resumo.getErros().size());
        } catch (Exception ex) {
            log.error("Scheduler Gmail TRT: falha na execução.", ex);
        }
    }
}
