package br.com.vilareal.financeiro.job;

import br.com.vilareal.financeiro.application.FinanceiroFaturaCartaoFechamentoService;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 06:05 America/Sao_Paulo — gera créditos-síntese (AUTO-FAT) para faturas vencidas.
 * Gatilho: data de vencimento, não importação.
 */
@Component
public class FinanceiroFaturaCartaoFechamentoJob {

    private static final Logger log = LoggerFactory.getLogger(FinanceiroFaturaCartaoFechamentoJob.class);

    private final FinanceiroFaturaCartaoFechamentoService fechamentoService;
    private final JobRunTracker jobRunTracker;

    public FinanceiroFaturaCartaoFechamentoJob(
            FinanceiroFaturaCartaoFechamentoService fechamentoService, JobRunTracker jobRunTracker) {
        this.fechamentoService = fechamentoService;
        this.jobRunTracker = jobRunTracker;
    }

    @Scheduled(cron = "0 5 6 * * ?", zone = "America/Sao_Paulo")
    public void rodar() {
        try {
            jobRunTracker.runTrackedJobVoid(JobNames.FINANCEIRO_FECHAMENTO_FATURA_CARTAO, ctx -> {
                int n = fechamentoService.aplicarFechamentosAutomaticos();
                ctx.setItemsProcessed(n);
                if (n > 0) {
                    log.info("[cartao-fechamento] Rotina diária processou {} fechamento(s).", n);
                }
            });
        } catch (Exception e) {
            log.warn("[cartao-fechamento] Falha na rotina diária: {}", e.getMessage());
        }
    }
}
