package br.com.vilareal.projudi.application;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Dispara protocolos PROJUDI agendados quando {@code protocolo_agendado_para} vence.
 */
@Component
public class ProjudiProtocoloAgendadoScheduler {

    private static final Logger log = LoggerFactory.getLogger(ProjudiProtocoloAgendadoScheduler.class);

    private final ProjudiPeticaoAgendamentoService agendamentoService;
    private final ProjudiPeticaoProtocoloLoteService protocoloLoteService;
    private final boolean ativo;

    public ProjudiProtocoloAgendadoScheduler(
            ProjudiPeticaoAgendamentoService agendamentoService,
            ProjudiPeticaoProtocoloLoteService protocoloLoteService,
            @Value("${vilareal.projudi.protocolo.agendamento.ativo:true}") boolean ativo) {
        this.agendamentoService = agendamentoService;
        this.protocoloLoteService = protocoloLoteService;
        this.ativo = ativo;
    }

    @Scheduled(fixedDelayString = "${vilareal.projudi.protocolo.agendamento.intervalo-ms:60000}")
    @SchedulerLock(
            name = "projudi-protocolo-agendado",
            lockAtMostFor = "PT10M",
            lockAtLeastFor = "PT20S")
    public void tick() {
        if (!ativo) {
            return;
        }
        List<Long> ids = agendamentoService.resolverIdsParaDisparoAgora();
        if (ids.isEmpty()) {
            return;
        }
        log.info("Protocolo agendado: disparando {} petição(ões) vencida(s): {}", ids.size(), ids);
        protocoloLoteService.protocolarLoteAssincrono(ids, true);
    }
}
