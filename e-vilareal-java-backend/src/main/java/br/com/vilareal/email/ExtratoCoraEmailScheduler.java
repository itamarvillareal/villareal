package br.com.vilareal.email;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class ExtratoCoraEmailScheduler {

    private static final Logger log = LoggerFactory.getLogger(ExtratoCoraEmailScheduler.class);

    private final GmailExtratoCoraService gmailExtratoCoraService;
    private final boolean importsCongelados;

    public ExtratoCoraEmailScheduler(
            @Autowired(required = false) GmailExtratoCoraService gmailExtratoCoraService,
            @Value("${cora.imports.frozen:false}") boolean importsCongelados) {
        this.gmailExtratoCoraService = gmailExtratoCoraService;
        this.importsCongelados = importsCongelados;
    }

    @Scheduled(fixedDelayString = "${cora.extrato.email.intervalo-ms:1800000}")
    @SchedulerLock(
            name = "extrato-cora-email",
            lockAtMostFor = "PT10M",
            lockAtLeastFor = "PT30S")
    public void importarExtratoCoraEmail() {
        try {
            if (importsCongelados) {
                log.warn("Scheduler extrato Cora ignorado: imports congelados (cora.imports.frozen=true).");
                return;
            }
            if (gmailExtratoCoraService == null || !gmailExtratoCoraService.isDisponivel()) {
                log.warn("Scheduler extrato Cora ignorado: Gmail indisponível (verifique credentials.json e tokens OAuth).");
                return;
            }
            log.info("Scheduler extrato Cora: início da execução.");
            ExtratoCoraEmailProcessamentoResumo resumo = gmailExtratoCoraService.buscarEImportarExtratos();
            log.info(
                    "Scheduler extrato Cora: fim — emailsProcessados={}, criados={}, jaExistiam={}, falhas={}, erros={}",
                    resumo.getEmailsProcessados(),
                    resumo.getLancamentosCriados(),
                    resumo.getLancamentosJaExistiam(),
                    resumo.getFalhas(),
                    resumo.getErros().size());
        } catch (IOException ex) {
            log.error("Scheduler extrato Cora: falha fatal na leitura Gmail: {}", ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("Scheduler extrato Cora: falha fatal: {}", ex.getMessage(), ex);
        }
    }
}
