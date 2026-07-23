package br.com.vilareal.calculo.job;

import br.com.vilareal.calculo.application.CalculoIndicesBcbService;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;

/**
 * Atualização automática dos índices econômicos (SGS/BCB) usados nos Cálculos.
 *
 * <p>Os índices do mês anterior saem em geral até o dia 10; o job roda <b>diariamente às 07:15</b>
 * (America/Sao_Paulo) a partir do dia 10 e persiste a competência do mês anterior de cada índice
 * assim que publicada — reexecuta nos dias seguintes só para o que ainda faltar (idempotente,
 * competência já gravada nunca é rebuscada).</p>
 */
@Component
public class CalculoIndicesAtualizacaoJob {

    private static final Logger log = LoggerFactory.getLogger(CalculoIndicesAtualizacaoJob.class);
    private static final ZoneId ZONA_SP = ZoneId.of("America/Sao_Paulo");

    private final CalculoIndicesBcbService indicesBcbService;
    private final JobRunTracker jobRunTracker;
    private final Clock clock;

    public CalculoIndicesAtualizacaoJob(
            CalculoIndicesBcbService indicesBcbService, JobRunTracker jobRunTracker, Clock clock) {
        this.indicesBcbService = indicesBcbService;
        this.jobRunTracker = jobRunTracker;
        this.clock = clock;
    }

    @Scheduled(cron = "0 15 7 * * ?", zone = "America/Sao_Paulo")
    @SchedulerLock(name = "calculo-indices-mensais", lockAtMostFor = "PT10M", lockAtLeastFor = "PT30S")
    public void atualizarIndicesMensais() {
        try {
            LocalDate hoje = LocalDate.now(clock.withZone(ZONA_SP));
            if (hoje.getDayOfMonth() < 10) {
                return;
            }
            jobRunTracker.runTrackedJobVoid(JobNames.CALCULO_INDICES_MENSAIS, ctx -> {
                YearMonth mesAnterior = YearMonth.from(hoje).minusMonths(1);
                ctx.putMetadata("competencia", mesAnterior.toString());
                int total = CalculoIndicesBcbService.indicesSuportados().size();
                int disponiveis = indicesBcbService.garantirMesAnteriorTodosIndices();
                ctx.setItemsProcessed(disponiveis);
                ctx.putMetadata("indicesPendentes", total - disponiveis);
                log.info(
                        "[indices-mensais] Competência {}: {}/{} índices publicados e persistidos.",
                        mesAnterior,
                        disponiveis,
                        total);
            });
        } catch (Exception e) {
            log.warn("[indices-mensais] Falha na atualização automática: {}", e.getMessage());
        }
    }
}
