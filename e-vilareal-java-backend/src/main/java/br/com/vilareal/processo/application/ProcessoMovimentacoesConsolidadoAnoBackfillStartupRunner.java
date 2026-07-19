package br.com.vilareal.processo.application;

import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Dispara backfill do PDF consolidado por ano CNJ no boot (ex.: todos os processos 2026 Projudi
 * com acervo integral completo). Controlado por propriedade — desligar após a primeira execução.
 */
@ConditionalOnProperty(
        prefix = "vilareal.processo.movimentacoes.consolidado.backfill",
        name = "disparar-ano-no-startup")
@Component
@Order(Integer.MAX_VALUE - 20)
public class ProcessoMovimentacoesConsolidadoAnoBackfillStartupRunner
        implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(ProcessoMovimentacoesConsolidadoAnoBackfillStartupRunner.class);

    private final ProcessoMovimentacoesConsolidadoDriveBackfillService backfillService;
    private final JobRunTracker jobRunTracker;
    private final int ano;

    public ProcessoMovimentacoesConsolidadoAnoBackfillStartupRunner(
            ProcessoMovimentacoesConsolidadoDriveBackfillService backfillService,
            JobRunTracker jobRunTracker,
            @Value("${vilareal.processo.movimentacoes.consolidado.backfill.disparar-ano-no-startup:0}")
                    int ano) {
        this.backfillService = backfillService;
        this.jobRunTracker = jobRunTracker;
        this.ano = ano;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (ano < 2000 || ano > 2100) {
            return;
        }
        log.info("Backfill consolidado Drive por ano CNJ={} agendado no startup.", ano);
        Long runId = jobRunTracker.submitAsyncJob(JobNames.CONSOLIDADO_DRIVE_BACKFILL, ctx -> {
            Map<String, Object> resumo = backfillService.executarBackfillPorAno(ano, ctx);
            Object res = resumo.get("resumo");
            if (res instanceof java.util.Map<?, ?> m) {
                Object integralizados = m.get("integralizados");
                if (integralizados instanceof Number n) {
                    ctx.setItemsProcessed(n.intValue());
                }
                Object erros = m.get("erros");
                if (erros instanceof Number n) {
                    ctx.setItemsFailed(n.intValue());
                }
            }
        });
        log.info(
                "Backfill consolidado Drive ano={} iniciado (runId={}). Acompanhe em /api/jobs/runs/{}",
                ano,
                runId,
                runId);
    }
}
