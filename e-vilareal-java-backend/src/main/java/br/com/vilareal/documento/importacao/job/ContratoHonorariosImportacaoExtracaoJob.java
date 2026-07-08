package br.com.vilareal.documento.importacao.job;

import br.com.vilareal.documento.importacao.application.ContratoHonorariosImportacaoApplicationService;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.Semaphore;

/** Processa fila de extração IA de contratos importados com throttle. */
@Component
public class ContratoHonorariosImportacaoExtracaoJob {

    private static final Logger log = LoggerFactory.getLogger(ContratoHonorariosImportacaoExtracaoJob.class);

    private final ContratoHonorariosImportacaoApplicationService importacaoService;
    private final JobRunTracker jobRunTracker;
    private final int batchSize;
    private final Semaphore semaforo;

    public ContratoHonorariosImportacaoExtracaoJob(
            ContratoHonorariosImportacaoApplicationService importacaoService,
            JobRunTracker jobRunTracker,
            @Value("${vilareal.honorarios.importacao.extracao.batch-size:5}") int batchSize,
            @Value("${vilareal.honorarios.importacao.extracao.concorrencia:2}") int concorrencia) {
        this.importacaoService = importacaoService;
        this.jobRunTracker = jobRunTracker;
        this.batchSize = Math.max(1, batchSize);
        this.semaforo = new Semaphore(Math.max(1, concorrencia));
    }

    @Scheduled(fixedDelayString = "${vilareal.honorarios.importacao.extracao.intervalo-ms:30000}")
    public void executar() {
        jobRunTracker.runTrackedJobVoid(JobNames.CONTRATO_HONORARIOS_IMPORTACAO_EXTRACAO, ctx -> {
            List<Long> pendentes = importacaoService.buscarPendentesExtracao(batchSize);
            int processados = 0;
            for (Long id : pendentes) {
                try {
                    semaforo.acquire();
                    try {
                        importacaoService.processarExtracaoItem(id);
                        processados++;
                    } finally {
                        semaforo.release();
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception ex) {
                    log.warn("Falha extração importação {}: {}", id, ex.getMessage());
                }
            }
            ctx.putMetadata("processados", processados);
            ctx.putMetadata("pendentesLote", pendentes.size());
        });
    }
}
