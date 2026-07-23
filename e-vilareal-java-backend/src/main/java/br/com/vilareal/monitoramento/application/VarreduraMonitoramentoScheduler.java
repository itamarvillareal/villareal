package br.com.vilareal.monitoramento.application;

import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.monitoramento.application.VarreduraPessoaService.MotivoNaoExecutada;
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
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Scheduler da varredura PROJUDI de pessoas monitoradas (descoberta de processos novos).
 *
 * <p>Em cada disparo do cron, varre <b>todas</b> as pessoas elegíveis (marcadas, ativas, com
 * CPF/CNPJ), na ordem de quem tem a última varredura mais antiga (nunca varridos primeiro).
 * Jitter aleatório entre pessoas para não criar padrão de tráfego regular contra o tribunal.
 * Interrompe o ciclo se houver operação prioritária do utilizador aguardando o robô
 * ({@link ProjudiOrquestradorGate#haPrioridadeAguardando()}) — checado antes do ciclo, entre
 * pessoas e dentro do serviço.</p>
 *
 * <p>Cadência padrão: 5 ciclos/dia via cron ({@code 06:00, 10:00, 14:00, 18:00, 22:00}
 * America/Sao_Paulo). Desligado por padrão ({@code vilareal.projudi.varredura.enabled=false});
 * sem a propriedade o bean nem sobe. ShedLock garante instância única; {@code lockAtMostFor}
 * de 12h cobre um ciclo completo com várias baselines grandes.</p>
 */
@Component
@ConditionalOnProperty(name = "vilareal.projudi.varredura.enabled", havingValue = "true")
public class VarreduraMonitoramentoScheduler {

    private static final Logger log = LoggerFactory.getLogger(VarreduraMonitoramentoScheduler.class);

    /** Limite de pessoas por ciclo (proteção; o escritório monitora dezenas, não milhares). */
    private static final int MAX_PESSOAS_POR_CICLO = 500;

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
            cron = "${vilareal.projudi.varredura.cron:0 0 6,10,14,18,22 * * *}",
            zone = "${vilareal.projudi.varredura.zone:America/Sao_Paulo}")
    @SchedulerLock(
            name = "projudi-varredura-monitoramento",
            lockAtMostFor = "PT12H",
            lockAtLeastFor = "PT30S")
    public void tick() {
        if (gate.haPrioridadeAguardando()) {
            log.debug("Varredura monitoramento: ciclo pulado — operação prioritária do utilizador.");
            return;
        }
        List<Long> ids = varreduraRepository.findPessoaIdsPorPrioridadeDeVarredura(
                PageRequest.of(0, MAX_PESSOAS_POR_CICLO));
        if (ids.isEmpty()) {
            log.debug("Varredura monitoramento: nenhuma pessoa marcada para monitoramento.");
            return;
        }

        log.info("Varredura monitoramento: iniciando ciclo com {} pessoa(s).", ids.size());
        int tentadas = 0;
        for (Long pessoaId : ids) {
            if (gate.haPrioridadeAguardando()) {
                log.info(
                        "Varredura monitoramento: ciclo interrompido após {} pessoa(s) — "
                                + "utilizador aguardando o robô.",
                        tentadas);
                break;
            }
            aplicarJitter();
            if (gate.haPrioridadeAguardando()) {
                log.info(
                        "Varredura monitoramento: ciclo interrompido após jitter — "
                                + "utilizador aguardando o robô.");
                break;
            }

            AtomicBoolean interromperCiclo = new AtomicBoolean(false);
            jobRunTracker.runTrackedJobVoid(JobNames.PROJUDI_VARREDURA_MONITORAMENTO, ctx -> {
                ctx.putMetadata("pessoaId", pessoaId);
                ctx.putMetadata("credencialId", credencialId);
                ResultadoVarredura r = varreduraService.varrerPessoa(pessoaId, credencialId, ctx);
                if (!r.executada()) {
                    ctx.putMetadata("resultado", "PULADA_" + r.motivoNaoExecutada());
                    // Gate ocupado ou prioridade do utilizador: não adianta tentar as próximas agora.
                    if (r.motivoNaoExecutada() == MotivoNaoExecutada.PRIORIDADE_USUARIO
                            || r.motivoNaoExecutada() == MotivoNaoExecutada.ROBO_OCUPADO) {
                        interromperCiclo.set(true);
                    }
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

            if (interromperCiclo.get()) {
                log.info(
                        "Varredura monitoramento: ciclo interrompido (gate/prioridade) após {} pessoa(s).",
                        tentadas);
                break;
            }
            tentadas++;
        }
        log.info("Varredura monitoramento: ciclo encerrado — {}/{} pessoa(s).", tentadas, ids.size());
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
