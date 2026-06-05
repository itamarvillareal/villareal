package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.api.dto.ResultadoMonitoramentoResponse;
import br.com.vilareal.agendamento.domain.OrigemConsulta;
import br.com.vilareal.agendamento.domain.StatusExecucao;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.AgendamentoConsultaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.projudi.ProjudiOtpGmailIndisponivelException;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import br.com.vilareal.projudi.ProjudiSessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConsultaPeriodicaMonitorSchedulerTest {

    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    private static final Instant INSTANT = Instant.parse("2026-06-05T12:00:00Z");
    private static final LocalDateTime AGORA = LocalDateTime.of(2026, 6, 5, 9, 0);
    private static final int RETRY_BASE = 10;
    private static final int RETRY_MAX = 60;

    @Mock
    private ProjudiOrquestradorGate orquestradorGate;

    @Mock
    private AgendamentoConsultaRepository agendamentoConsultaRepository;

    @Mock
    private ProjudiSessionService sessionService;

    @Mock
    private MonitoramentoMovimentacoesService monitoramentoMovimentacoesService;

    private ConsultaPeriodicaMonitorScheduler scheduler;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(INSTANT, ZONE);
        scheduler = new ConsultaPeriodicaMonitorScheduler(
                orquestradorGate,
                agendamentoConsultaRepository,
                sessionService,
                monitoramentoMovimentacoesService,
                clock,
                1L,
                RETRY_BASE,
                RETRY_MAX);
    }

    @Test
    void executarRodada_gateOcupado_naoChamaNucleo() {
        when(orquestradorGate.tryExecutar(eq("consulta-periodica-monitor"), any(Runnable.class)))
                .thenReturn(false);

        scheduler.executarRodada();

        verify(agendamentoConsultaRepository, never()).findVencidosComProcesso(any());
        verify(monitoramentoMovimentacoesService, never()).executarMonitoramento(any(), any(), any());
    }

    @Test
    void executarRodada_warmUpGmailIndisponivel_pulaRodadaSemBackoffNemRegistro() {
        when(orquestradorGate.tryExecutar(eq("consulta-periodica-monitor"), any(Runnable.class)))
                .thenAnswer(inv -> {
                    Runnable r = inv.getArgument(1);
                    r.run();
                    return true;
                });
        AgendamentoConsultaEntity ag = agendamento(10L, 1076L);
        ag.setFalhasConsecutivas(3);
        ag.setUltimoErro("erro anterior");
        when(agendamentoConsultaRepository.findVencidosComProcesso(AGORA)).thenReturn(List.of(ag));
        doThrow(new ProjudiOtpGmailIndisponivelException())
                .when(sessionService)
                .getSessao(1L);

        scheduler.executarRodada();

        verify(monitoramentoMovimentacoesService, never()).executarMonitoramento(any(), any(), any());
        verify(monitoramentoMovimentacoesService, never()).registrarFalhaAgendada(any(), any(), any());
        verify(agendamentoConsultaRepository, never()).save(any());
        assertThat(ag.getFalhasConsecutivas()).isEqualTo(3);
        assertThat(ag.getUltimoErro()).isEqualTo("erro anterior");
    }

    @Test
    void executarRodada_warmUpFalha_registraErroPorVencidoComBackoff() {
        when(orquestradorGate.tryExecutar(eq("consulta-periodica-monitor"), any(Runnable.class)))
                .thenAnswer(inv -> {
                    Runnable r = inv.getArgument(1);
                    r.run();
                    return true;
                });
        AgendamentoConsultaEntity ag = agendamento(10L, 1076L);
        when(agendamentoConsultaRepository.findVencidosComProcesso(AGORA)).thenReturn(List.of(ag));
        doThrow(new IllegalStateException("Token OTP não recebido no prazo."))
                .when(sessionService)
                .getSessao(1L);

        scheduler.executarRodada();

        verify(monitoramentoMovimentacoesService, never()).executarMonitoramento(any(), any(), any());
        verify(monitoramentoMovimentacoesService)
                .registrarFalhaAgendada(ag.getProcesso(), 10L, "falha no login/warm-up: Token OTP não recebido no prazo.");

        ArgumentCaptor<AgendamentoConsultaEntity> cap = ArgumentCaptor.forClass(AgendamentoConsultaEntity.class);
        verify(agendamentoConsultaRepository).save(cap.capture());
        AgendamentoConsultaEntity salvo = cap.getValue();
        assertThat(salvo.getProximaExecucao()).isEqualTo(AGORA.plusMinutes(10));
        assertThat(salvo.getFalhasConsecutivas()).isEqualTo(1);
        assertThat(salvo.getUltimoErro()).contains("warm-up");
        assertThat(salvo.getUltimaFalhaEm()).isEqualTo(AGORA);
    }

    @Test
    void executarRodada_itemSucesso_usaCadenciaEZeraFalhas() {
        when(orquestradorGate.tryExecutar(eq("consulta-periodica-monitor"), any(Runnable.class)))
                .thenAnswer(inv -> {
                    Runnable r = inv.getArgument(1);
                    r.run();
                    return true;
                });
        AgendamentoConsultaEntity ag = agendamento(10L, 1076L);
        ag.setFalhasConsecutivas(2);
        ag.setUltimoErro("erro");
        when(agendamentoConsultaRepository.findVencidosComProcesso(AGORA)).thenReturn(List.of(ag));
        when(monitoramentoMovimentacoesService.executarMonitoramento(
                        ag.getProcesso(), OrigemConsulta.AGENDADA, 10L))
                .thenReturn(resultado(StatusExecucao.SUCESSO_SEM_NOVIDADE));

        scheduler.executarRodada();

        ArgumentCaptor<AgendamentoConsultaEntity> cap = ArgumentCaptor.forClass(AgendamentoConsultaEntity.class);
        verify(agendamentoConsultaRepository).save(cap.capture());
        assertThat(cap.getValue().getProximaExecucao()).isEqualTo(AGORA.plusMinutes(60));
        assertThat(cap.getValue().getFalhasConsecutivas()).isZero();
        assertThat(cap.getValue().getUltimoErro()).isNull();
    }

    @Test
    void executarRodada_itemErro_usaBackoffNaoCadencia() {
        when(orquestradorGate.tryExecutar(eq("consulta-periodica-monitor"), any(Runnable.class)))
                .thenAnswer(inv -> {
                    Runnable r = inv.getArgument(1);
                    r.run();
                    return true;
                });
        AgendamentoConsultaEntity ag = agendamento(10L, 1076L);
        when(agendamentoConsultaRepository.findVencidosComProcesso(AGORA)).thenReturn(List.of(ag));
        when(monitoramentoMovimentacoesService.executarMonitoramento(
                        ag.getProcesso(), OrigemConsulta.AGENDADA, 10L))
                .thenReturn(resultadoErro("timeout PROJUDI"));

        scheduler.executarRodada();

        ArgumentCaptor<AgendamentoConsultaEntity> cap = ArgumentCaptor.forClass(AgendamentoConsultaEntity.class);
        verify(agendamentoConsultaRepository).save(cap.capture());
        assertThat(cap.getValue().getProximaExecucao()).isEqualTo(AGORA.plusMinutes(10));
        assertThat(cap.getValue().getFalhasConsecutivas()).isEqualTo(1);
        assertThat(cap.getValue().getUltimoErro()).isEqualTo("timeout PROJUDI");
        assertThat(cap.getValue().getUltimaFalhaEm()).isEqualTo(AGORA);
    }

    @Test
    void executarRodada_doisVencidos_sucessoERegraBackoffDistinta() {
        when(orquestradorGate.tryExecutar(eq("consulta-periodica-monitor"), any(Runnable.class)))
                .thenAnswer(inv -> {
                    Runnable r = inv.getArgument(1);
                    r.run();
                    return true;
                });
        AgendamentoConsultaEntity ok = agendamento(10L, 1076L);
        ok.setIntervaloMinutos(60);
        AgendamentoConsultaEntity falha = agendamento(11L, 2000L);
        falha.setIntervaloMinutos(30);
        when(agendamentoConsultaRepository.findVencidosComProcesso(AGORA)).thenReturn(List.of(ok, falha));
        when(monitoramentoMovimentacoesService.executarMonitoramento(
                        ok.getProcesso(), OrigemConsulta.AGENDADA, 10L))
                .thenReturn(resultado(StatusExecucao.SUCESSO_SEM_NOVIDADE));
        when(monitoramentoMovimentacoesService.executarMonitoramento(
                        falha.getProcesso(), OrigemConsulta.AGENDADA, 11L))
                .thenReturn(resultadoErro("falha"));

        scheduler.executarRodada();

        verify(monitoramentoMovimentacoesService, times(2))
                .executarMonitoramento(any(ProcessoEntity.class), eq(OrigemConsulta.AGENDADA), any(Long.class));

        ArgumentCaptor<AgendamentoConsultaEntity> cap = ArgumentCaptor.forClass(AgendamentoConsultaEntity.class);
        verify(agendamentoConsultaRepository, times(2)).save(cap.capture());
        assertThat(cap.getAllValues().get(0).getProximaExecucao()).isEqualTo(AGORA.plusMinutes(60));
        assertThat(cap.getAllValues().get(1).getProximaExecucao()).isEqualTo(AGORA.plusMinutes(10));
    }

    private static ResultadoMonitoramentoResponse resultado(StatusExecucao status) {
        return ResultadoMonitoramentoResponse.builder()
                .processoId(1076L)
                .numeroCnj("5059346-36.2026.8.09.0007")
                .status(status)
                .totalListadas(36)
                .baseline(false)
                .novas(0)
                .novasMovimentacoes(List.of())
                .execucaoId(1L)
                .build();
    }

    private static ResultadoMonitoramentoResponse resultadoErro(String erro) {
        return ResultadoMonitoramentoResponse.builder()
                .processoId(1076L)
                .numeroCnj("5059346-36.2026.8.09.0007")
                .status(StatusExecucao.ERRO)
                .totalListadas(0)
                .baseline(false)
                .novas(0)
                .novasMovimentacoes(List.of())
                .execucaoId(2L)
                .erro(erro)
                .build();
    }

    private static AgendamentoConsultaEntity agendamento(long agId, long processoId) {
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(processoId);
        processo.setNumeroCnj("5059346-36.2026.8.09.0007");

        AgendamentoConsultaEntity a = new AgendamentoConsultaEntity();
        a.setId(agId);
        a.setProcesso(processo);
        a.setAtivo(true);
        a.setTipoCadencia(TipoCadencia.INTERVALO);
        a.setIntervaloMinutos(60);
        a.setFalhasConsecutivas(0);
        a.setProximaExecucao(AGORA.minusMinutes(5));
        return a;
    }
}
