package br.com.vilareal.pagamento.job;

import br.com.vilareal.financeiro.application.ExtratoPosImportApplicationService;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.pagamento.application.PagamentoApplicationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class PagamentoRotinaDiariaJob {

    private static final Logger log = LoggerFactory.getLogger(PagamentoRotinaDiariaJob.class);

    private final PagamentoApplicationService pagamentoApplicationService;
    private final ExtratoPosImportApplicationService extratoPosImportApplicationService;
    private final JobRunTracker jobRunTracker;

    public PagamentoRotinaDiariaJob(
            PagamentoApplicationService pagamentoApplicationService,
            ExtratoPosImportApplicationService extratoPosImportApplicationService,
            JobRunTracker jobRunTracker) {
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.extratoPosImportApplicationService = extratoPosImportApplicationService;
        this.jobRunTracker = jobRunTracker;
    }

    /** 06:00 America/Sao_Paulo — atualiza PENDENTE→VENCIDO, AGENDADO→CONFERENCIA_PENDENTE após calendário. */
    @Scheduled(cron = "0 0 6 * * ?", zone = "America/Sao_Paulo")
    public void rodar() {
        try {
            jobRunTracker.runTrackedJobVoid(JobNames.PAGAMENTO_ROTINA_DIARIA, ctx -> {
                int n = pagamentoApplicationService.aplicarTransicoesAutomaticasPorData();
                int honorarios = conciliarHonorariosRedeSeguranca();
                ctx.setItemsProcessed(n + honorarios);
                if (n > 0) {
                    log.info("[pagamentos] Rotina diária alterou {} registro(s).", n);
                }
            });
        } catch (Exception e) {
            log.warn("[pagamentos] Falha na rotina diária: {}", e.getMessage());
        }
    }

    private int conciliarHonorariosRedeSeguranca() {
        try {
            var r = extratoPosImportApplicationService.conciliarHonorariosRedeSeguranca();
            if (r.autoConciliados() > 0 || r.ambiguos() > 0) {
                log.info(
                        "[pagamentos] Rede segurança honorários pós-import: {} auto-conciliado(s), {} ambíguo(s).",
                        r.autoConciliados(),
                        r.ambiguos());
            }
            return r.autoConciliados();
        } catch (Exception e) {
            log.warn("[pagamentos] Rede segurança honorários pós-import falhou: {}", e.getMessage());
            return 0;
        }
    }
}
