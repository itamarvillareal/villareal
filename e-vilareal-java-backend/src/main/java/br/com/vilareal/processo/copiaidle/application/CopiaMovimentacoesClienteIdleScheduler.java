package br.com.vilareal.processo.copiaidle.application;

import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.processo.copiaidle.config.CopiaMovimentacoesClienteIdleProperties;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduler da cópia idle de movimentações do cliente configurado (padrão 00000728).
 *
 * <p>Roda na madrugada e <b>só avança quando PROJUDI e PJe estão ociosos</b> — zero concorrência
 * com protocolo, consulta periódica, pipeline e demais robôs. Pode levar vários dias.
 */
@Component
@ConditionalOnProperty(
        prefix = "vilareal.processo.copia-movimentacoes-cliente-idle",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
public class CopiaMovimentacoesClienteIdleScheduler {

    private static final Logger log = LoggerFactory.getLogger(CopiaMovimentacoesClienteIdleScheduler.class);

    private final CopiaMovimentacoesClienteIdleService service;
    private final JobRunTracker jobRunTracker;
    private final CopiaMovimentacoesClienteIdleProperties properties;

    public CopiaMovimentacoesClienteIdleScheduler(
            CopiaMovimentacoesClienteIdleService service,
            JobRunTracker jobRunTracker,
            CopiaMovimentacoesClienteIdleProperties properties) {
        this.service = service;
        this.jobRunTracker = jobRunTracker;
        this.properties = properties;
    }

    @Scheduled(
            fixedDelayString = "${vilareal.processo.copia-movimentacoes-cliente-idle.intervalo-ms:120000}",
            initialDelayString = "${vilareal.processo.copia-movimentacoes-cliente-idle.initial-delay-ms:90000}")
    @SchedulerLock(
            name = "copia-movimentacoes-cliente-idle",
            lockAtMostFor = "PT45M",
            lockAtLeastFor = "PT20S")
    public void tick() {
        if (!service.estaNaJanelaMadrugada()) {
            return;
        }
        if (!service.sistemaOcioso()) {
            log.debug(
                    "Cópia idle: tick na janela mas sistema ocupado (cliente={}).",
                    properties.getCodigoCliente());
            return;
        }
        try {
            jobRunTracker.runTrackedJobVoid(JobNames.COPIA_MOVIMENTACOES_CLIENTE_IDLE, service::executarTick);
        } catch (Exception e) {
            log.warn("Cópia idle: falha no tick: {}", e.getMessage());
        }
    }
}
