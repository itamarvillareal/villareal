package br.com.vilareal.monitoramento.application;

import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.monitoramento.application.VarreduraPessoaService.ResultadoVarredura;
import br.com.vilareal.monitoramento.domain.StatusVarredura;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.VarreduraPessoaRepository;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Scheduler da varredura PROJUDI de pessoas monitoradas (descoberta de processos novos).
 *
 * <p>Uma pessoa por tick, priorizando quem tem a última varredura mais antiga (nunca
 * varridos primeiro). Jitter aleatório antes de cada varredura para não criar padrão de
 * tráfego regular contra o tribunal. Nunca inicia se há operação prioritária do utilizador
 * aguardando o robô ({@link ProjudiOrquestradorGate#haPrioridadeAguardando()}) — checado
 * aqui E dentro do serviço, antes e depois do jitter.</p>
 *
 * <p>Desligado por padrão ({@code vilareal.projudi.varredura.enabled=false}); sem a
 * propriedade o bean nem sobe. ShedLock garante instância única; {@code lockAtMostFor}
 * de 2h cobre a baseline de acervos grandes (~225 páginas numa posse do gate).</p>
 */
@Component
@ConditionalOnProperty(name = "vilareal.projudi.varredura.enabled", havingValue = "true")
public class VarreduraMonitoramentoScheduler {

    private static final Logger log = LoggerFactory.getLogger(VarreduraMonitoramentoScheduler.class);

    private final VarreduraPessoaService varreduraService;
    private final VarreduraPessoaRepository varreduraRepository;
    private final ProjudiOrquestradorGate gate;
    private final JobRunTracker jobRunTracker;
    /**
     * Credencial PROJUDI da varredura: por padrão a MESMA credencial padrão do orquestrador
     * ({@code projudi.orquestrador.credencial-id-padrao}), reaproveitando a sessão/OTP já
     * mantida pelas consultas periódicas; sobrescrevível por
     * {@code vilareal.projudi.varredura.credencial-id}.
     */
    private final Long credencialId;
    private final long jitterMaxMs;

    public VarreduraMonitoramentoScheduler(
            VarreduraPessoaService varreduraService,
            VarreduraPessoaRepository varreduraRepository,
            ProjudiOrquestradorGate gate,
            JobRunTracker jobRunTracker,
            @Value("${vilareal.projudi.varredura.credencial-id:${projudi.orquestrador.credencial-id-padrao:1}}")
                    Long credencialId,
            @Value("${vilareal.projudi.varredura.jitter-max-ms:90000}") long jitterMaxMs) {
        this.varreduraService = varreduraService;
        this.varreduraRepository = varreduraRepository;
        this.gate = gate;
        this.jobRunTracker = jobRunTracker;
        this.credencialId = credencialId;
        this.jitterMaxMs = jitterMaxMs;
    }

    @Scheduled(
            fixedDelayString = "${vilareal.projudi.varredura.intervalo-ms:300000}",
            initialDelayString = "${vilareal.projudi.varredura.atraso-inicial-ms:120000}")
    @SchedulerLock(
            name = "projudi-varredura-monitoramento",
            lockAtMostFor = "PT2H",
            lockAtLeastFor = "PT30S")
    public void tick() {
        if (gate.haPrioridadeAguardando()) {
            log.debug("Varredura monitoramento: tick pulado — operação prioritária do utilizador.");
            return;
        }
        List<Long> ids = varreduraRepository.findPessoaIdsPorPrioridadeDeVarredura(PageRequest.of(0, 1));
        if (ids.isEmpty()) {
            log.debug("Varredura monitoramento: nenhuma pessoa marcada para monitoramento.");
            return;
        }
        Long pessoaId = ids.get(0);

        aplicarJitter();
        // O jitter pode ter durado mais de um minuto — rechecar antes de tomar o robô.
        if (gate.haPrioridadeAguardando()) {
            log.info("Varredura monitoramento: pulada após jitter — utilizador aguardando o robô.");
            return;
        }

        jobRunTracker.runTrackedJobVoid(JobNames.PROJUDI_VARREDURA_MONITORAMENTO, ctx -> {
            ctx.putMetadata("pessoaId", pessoaId);
            ctx.putMetadata("credencialId", credencialId);
            ResultadoVarredura r = varreduraService.varrerPessoa(pessoaId, credencialId, ctx);
            if (!r.executada()) {
                ctx.putMetadata("resultado", "PULADA_" + r.motivoNaoExecutada());
                return;
            }
            ctx.putMetadata("resultado", String.valueOf(r.status()));
            ctx.putMetadata("varreduraId", r.varreduraId());
            ctx.putMetadata("paginasLidas", r.paginasLidas());
            ctx.putMetadata("novos", r.novos());
            ctx.putMetadata("qtdSegredo", r.qtdSegredo());
            if (!r.alertasSegredo().isEmpty()) {
                ctx.putMetadata("alertasSegredo", String.join(" | ", r.alertasSegredo()));
            }
            ctx.setItemsProcessed(r.encontrados());
            if (r.status() == StatusVarredura.ERRO) {
                ctx.addItemsFailed(1);
            }
        });
    }

    private void aplicarJitter() {
        if (jitterMaxMs <= 0) {
            return;
        }
        long espera = ThreadLocalRandom.current().nextLong(jitterMaxMs);
        try {
            Thread.sleep(espera);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
