package br.com.vilareal.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
public class PublicacaoEmailScheduler {

    private static final Logger log = LoggerFactory.getLogger(PublicacaoEmailScheduler.class);

    private final GmailPublicacaoService gmailPublicacaoService;

    public PublicacaoEmailScheduler(@Autowired(required = false) GmailPublicacaoService gmailPublicacaoService) {
        this.gmailPublicacaoService = gmailPublicacaoService;
    }

    @Scheduled(fixedRate = 3, timeUnit = TimeUnit.HOURS)
    public void processarPublicacoesEmail() {
        if (gmailPublicacaoService == null || !gmailPublicacaoService.isDisponivel()) {
            log.debug("Scheduler Gmail publicações ignorado: integração indisponível.");
            return;
        }
        log.info("Scheduler Gmail publicações: início da execução.");
        try {
            PublicacaoEmailProcessamentoResumo resumo = gmailPublicacaoService.buscarEProcessarPublicacoes();
            log.info(
                    "Scheduler Gmail publicações: fim — emailsLidos={}, publicacoesProcessadas={}, erros={}",
                    resumo.getEmailsLidos(),
                    resumo.getPublicacoesProcessadas(),
                    resumo.getErros().size());
        } catch (Exception ex) {
            log.error("Scheduler Gmail publicações: falha na execução.", ex);
        }
    }
}
