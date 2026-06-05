package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.api.dto.ResultadoMonitoramentoResponse;
import br.com.vilareal.agendamento.domain.OrigemConsulta;
import br.com.vilareal.agendamento.domain.StatusExecucao;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.AgendamentoConsultaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.projudi.ProjudiOtpGmailIndisponivelException;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import br.com.vilareal.projudi.ProjudiSessionService;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduler da consulta periódica (Fase 3 passo 4/4.1): gate + warm-up + N vencidos; falha → backoff curto.
 */
@Component
public class ConsultaPeriodicaMonitorScheduler {

    private static final Logger log = LoggerFactory.getLogger(ConsultaPeriodicaMonitorScheduler.class);

    private final ProjudiOrquestradorGate orquestradorGate;
    private final AgendamentoConsultaRepository agendamentoConsultaRepository;
    private final ProjudiSessionService sessionService;
    private final MonitoramentoMovimentacoesService monitoramentoMovimentacoesService;
    private final Clock clock;
    private final Long credencialIdPadrao;
    private final int retryBaseMin;
    private final int retryMaxMin;

    public ConsultaPeriodicaMonitorScheduler(
            ProjudiOrquestradorGate orquestradorGate,
            AgendamentoConsultaRepository agendamentoConsultaRepository,
            ProjudiSessionService sessionService,
            MonitoramentoMovimentacoesService monitoramentoMovimentacoesService,
            Clock clock,
            @Value("${projudi.orquestrador.credencial-id-padrao:1}") Long credencialIdPadrao,
            @Value("${monitor.scheduler.retry-base-min:10}") int retryBaseMin,
            @Value("${monitor.scheduler.retry-max-min:60}") int retryMaxMin) {
        this.orquestradorGate = orquestradorGate;
        this.agendamentoConsultaRepository = agendamentoConsultaRepository;
        this.sessionService = sessionService;
        this.monitoramentoMovimentacoesService = monitoramentoMovimentacoesService;
        this.clock = clock;
        this.credencialIdPadrao = credencialIdPadrao;
        this.retryBaseMin = retryBaseMin;
        this.retryMaxMin = retryMaxMin;
    }

    @Scheduled(fixedDelayString = "${monitor.scheduler.intervalo-ms:60000}")
    @SchedulerLock(
            name = "consulta-periodica-monitor",
            lockAtMostFor = "PT15M",
            lockAtLeastFor = "PT30S")
    public void tick() {
        executarRodada();
    }

    void executarRodada() {
        boolean executou = orquestradorGate.tryExecutar("consulta-periodica-monitor", this::processarVencidosComSessao);
        if (!executou) {
            log.debug("Consulta periódica: robô PROJUDI ocupado; tick ignorado (vencidos permanecem).");
        }
    }

    private void processarVencidosComSessao() {
        LocalDateTime agora = agora();
        List<AgendamentoConsultaEntity> vencidos = agendamentoConsultaRepository.findVencidosComProcesso(agora);
        if (vencidos.isEmpty()) {
            return;
        }

        try {
            sessionService.getSessao(credencialIdPadrao);
        } catch (ProjudiOtpGmailIndisponivelException e) {
            log.warn(
                    "Consulta periódica: rodada pulada — Gmail indisponível para OTP PROJUDI (credencial={}): {}. "
                            + "{} agendamento(s) vencido(s) permanecem sem alterar falhas_consecutivas.",
                    credencialIdPadrao,
                    e.getMessage(),
                    vencidos.size());
            return;
        } catch (Exception e) {
            tratarFalhaWarmUpRodada(vencidos, agora, e);
            return;
        }

        log.info("Consulta periódica: processando {} agendamento(s) vencido(s).", vencidos.size());
        for (AgendamentoConsultaEntity agendamento : vencidos) {
            processarItem(agendamento, agora);
        }
    }

    private void tratarFalhaWarmUpRodada(
            List<AgendamentoConsultaEntity> vencidos, LocalDateTime agora, Exception e) {
        String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        log.warn(
                "Consulta periódica: falha no warm-up da sessão PROJUDI (credencial={}): {} — "
                        + "aplicando backoff em {} agendamento(s).",
                credencialIdPadrao,
                msg,
                vencidos.size());
        String mensagemItem = "falha no login/warm-up: " + msg;
        for (AgendamentoConsultaEntity agendamento : vencidos) {
            try {
                ProcessoEntity processo = agendamento.getProcesso();
                monitoramentoMovimentacoesService.registrarFalhaAgendada(
                        processo, agendamento.getId(), mensagemItem);
            } catch (Exception ex) {
                log.warn(
                        "Consulta periódica: falha ao registrar execução de warm-up (agendamento {}): {}",
                        agendamento.getId(),
                        ex.getMessage());
            }
            AgendamentoConsultaReagendamento.aplicarFalha(agendamento, agora, mensagemItem, retryBaseMin, retryMaxMin);
            agendamentoConsultaRepository.save(agendamento);
        }
    }

    private void processarItem(AgendamentoConsultaEntity agendamento, LocalDateTime agora) {
        Long agendamentoId = agendamento.getId();
        ResultadoMonitoramentoResponse resultado = null;
        String erroExcecao = null;
        try {
            ProcessoEntity processo = agendamento.getProcesso();
            resultado = monitoramentoMovimentacoesService.executarMonitoramento(
                    processo, OrigemConsulta.AGENDADA, agendamentoId);
        } catch (Exception e) {
            erroExcecao = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            log.warn(
                    "Consulta periódica: falha no monitor do agendamento {} (processo {}): {}",
                    agendamentoId,
                    agendamento.getProcesso() != null ? agendamento.getProcesso().getId() : null,
                    erroExcecao);
        }

        if (resultado != null && AgendamentoConsultaReagendamento.isStatusSucesso(resultado.getStatus())) {
            AgendamentoConsultaReagendamento.aplicarSucesso(agendamento, agora);
        } else {
            String mensagem = resolverMensagemFalha(resultado, erroExcecao);
            AgendamentoConsultaReagendamento.aplicarFalha(agendamento, agora, mensagem, retryBaseMin, retryMaxMin);
        }
        agendamentoConsultaRepository.save(agendamento);
    }

    private static String resolverMensagemFalha(ResultadoMonitoramentoResponse resultado, String erroExcecao) {
        if (resultado != null && StringUtils.hasText(resultado.getErro())) {
            return resultado.getErro();
        }
        if (resultado != null && resultado.getStatus() == StatusExecucao.ERRO) {
            return "Monitor retornou ERRO sem mensagem.";
        }
        if (StringUtils.hasText(erroExcecao)) {
            return erroExcecao;
        }
        return "Falha desconhecida no monitor agendado.";
    }

    private LocalDateTime agora() {
        return clock.instant().atZone(clock.getZone()).toLocalDateTime();
    }
}
