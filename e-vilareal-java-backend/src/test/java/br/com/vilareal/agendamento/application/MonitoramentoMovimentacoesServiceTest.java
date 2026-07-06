package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.api.dto.ResultadoMonitoramentoResponse;
import br.com.vilareal.agendamento.domain.OrigemConsulta;
import br.com.vilareal.agendamento.domain.StatusExecucao;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.ConsultaProcessoExecucaoEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.ConsultaProcessoExecucaoRepository;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.MovimentacaoMonitoradaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import br.com.vilareal.citacao.application.CitacaoAutoLinkService;
import br.com.vilareal.notificacao.api.dto.NotificacaoResultado;
import br.com.vilareal.notificacao.application.NotificacaoMovimentacaoService;
import br.com.vilareal.notificacao.domain.NotificacaoEnvioStatus;
import br.com.vilareal.projudi.pipeline.ProjudiMovimentacoesListagemService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MonitoramentoMovimentacoesServiceTest {

    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    private static final Instant INSTANT = Instant.parse("2026-06-04T20:00:00Z");

    @Mock
    private ProjudiMovimentacoesListagemService listagemService;

    @Mock
    private MovimentacaoMonitoradaRepository movimentacaoMonitoradaRepository;

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private ConsultaProcessoExecucaoRepository consultaProcessoExecucaoRepository;

    @Mock
    private ProjudiOrquestradorGate orquestradorGate;

    @Mock
    private NotificacaoMovimentacaoService notificacaoMovimentacaoService;

    @Mock
    private CitacaoAutoLinkService citacaoAutoLinkService;

    private MonitoramentoMovimentacoesService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(INSTANT, ZONE);
        service = new MonitoramentoMovimentacoesService(
                listagemService,
                movimentacaoMonitoradaRepository,
                processoRepository,
                consultaProcessoExecucaoRepository,
                orquestradorGate,
                notificacaoMovimentacaoService,
                citacaoAutoLinkService,
                clock,
                1L);
    }

    @Test
    void monitorarProcesso_gateOcupado_puladaSemListagem() {
        ProcessoEntity processo = processo(1076L);
        when(processoRepository.findByIdWithClienteAndPessoa(1076L)).thenReturn(Optional.of(processo));
        when(orquestradorGate.tryExecutarComRetorno(anyString(), any())).thenReturn(Optional.empty());
        when(consultaProcessoExecucaoRepository.save(any())).thenAnswer(inv -> {
            ConsultaProcessoExecucaoEntity e = inv.getArgument(0);
            e.setId(99L);
            return e;
        });

        ResultadoMonitoramentoResponse r = service.monitorarProcesso(1076L);

        assertThat(r.getStatus()).isEqualTo(StatusExecucao.PULADA_OCUPADO);
        assertThat(r.getTotalListadas()).isZero();
        verify(listagemService, org.mockito.Mockito.never()).listarMovimentacoesComFallbackReduzido(any(), any());
    }

    @Test
    void monitorarProcesso_baseline_semNovidadeSinalizada() {
        ProcessoEntity processo = processo(1076L);
        when(processoRepository.findByIdWithClienteAndPessoa(1076L)).thenReturn(Optional.of(processo));
        when(orquestradorGate.tryExecutarComRetorno(anyString(), any())).thenAnswer(inv -> {
            @SuppressWarnings("unchecked")
            Supplier<ResultadoMonitoramentoResponse> action = inv.getArgument(1);
            return Optional.of(action.get());
        });
        when(movimentacaoMonitoradaRepository.countByProcessoId(1076L)).thenReturn(0L);
        when(movimentacaoMonitoradaRepository.findByProcessoId(1076L)).thenReturn(List.of());
        when(listagemService.listarMovimentacoesComFallbackReduzido(1L, processo.getNumeroCnj()))
                .thenReturn(List.of(mov("1", "481112537"), mov("2", "481112538")));
        when(consultaProcessoExecucaoRepository.save(any())).thenAnswer(inv -> {
            ConsultaProcessoExecucaoEntity e = inv.getArgument(0);
            e.setId(1L);
            return e;
        });

        ResultadoMonitoramentoResponse r = service.monitorarProcesso(1076L);

        assertThat(r.isBaseline()).isTrue();
        assertThat(r.getNovas()).isZero();
        assertThat(r.getNovasMovimentacoes()).isEmpty();
        assertThat(r.getStatus()).isEqualTo(StatusExecucao.SUCESSO_SEM_NOVIDADE);
        assertThat(r.getTotalListadas()).isEqualTo(2);
        verify(movimentacaoMonitoradaRepository, org.mockito.Mockito.times(2)).save(any());

        ArgumentCaptor<ConsultaProcessoExecucaoEntity> cap = ArgumentCaptor.forClass(ConsultaProcessoExecucaoEntity.class);
        verify(consultaProcessoExecucaoRepository).save(cap.capture());
        assertThat(cap.getValue().getOrigem()).isEqualTo(OrigemConsulta.MANUAL);
        assertThat(cap.getValue().getTeoresNovos()).isZero();
        assertThat(cap.getValue().getArquivosBaixados()).isZero();
        assertThat(cap.getValue().getNotificacaoStatus()).isEqualTo(NotificacaoEnvioStatus.NAO_APLICAVEL);
        verify(notificacaoMovimentacaoService, org.mockito.Mockito.never())
                .notificarNovidade(any(), any());
    }

    @Test
    void executarMonitoramento_agendada_gravaOrigemEAgendamento() {
        ProcessoEntity processo = processo(1076L);
        when(movimentacaoMonitoradaRepository.countByProcessoId(1076L)).thenReturn(1L);
        when(movimentacaoMonitoradaRepository.findByProcessoId(1076L)).thenReturn(List.of());
        when(listagemService.listarMovimentacoesComFallbackReduzido(1L, processo.getNumeroCnj()))
                .thenReturn(List.of(mov("1", "481112537")));
        when(consultaProcessoExecucaoRepository.save(any())).thenAnswer(inv -> {
            ConsultaProcessoExecucaoEntity e = inv.getArgument(0);
            e.setId(5L);
            return e;
        });

        ResultadoMonitoramentoResponse r =
                service.executarMonitoramento(processo, OrigemConsulta.AGENDADA, 42L);

        assertThat(r.getStatus()).isEqualTo(StatusExecucao.SUCESSO_COM_NOVIDADE);
        ArgumentCaptor<ConsultaProcessoExecucaoEntity> cap = ArgumentCaptor.forClass(ConsultaProcessoExecucaoEntity.class);
        verify(consultaProcessoExecucaoRepository).save(cap.capture());
        assertThat(cap.getValue().getOrigem()).isEqualTo(OrigemConsulta.AGENDADA);
        assertThat(cap.getValue().getAgendamento()).isNotNull();
        assertThat(cap.getValue().getAgendamento().getId()).isEqualTo(42L);
    }

    @Test
    void monitorarProcesso_naoBaseline_comNovidade() {
        ProcessoEntity processo = processo(1076L);
        MovimentacaoMonitoradaEntity existente = new MovimentacaoMonitoradaEntity();
        existente.setIdMovi("481112537");

        when(processoRepository.findByIdWithClienteAndPessoa(1076L)).thenReturn(Optional.of(processo));
        when(orquestradorGate.tryExecutarComRetorno(anyString(), any())).thenAnswer(inv -> {
            @SuppressWarnings("unchecked")
            Supplier<ResultadoMonitoramentoResponse> action = inv.getArgument(1);
            return Optional.of(action.get());
        });
        when(movimentacaoMonitoradaRepository.countByProcessoId(1076L)).thenReturn(1L);
        when(movimentacaoMonitoradaRepository.findByProcessoId(1076L)).thenReturn(List.of(existente));
        when(listagemService.listarMovimentacoesComFallbackReduzido(1L, processo.getNumeroCnj()))
                .thenReturn(List.of(mov("1", "481112537"), mov("2", "481112538")));
        when(consultaProcessoExecucaoRepository.save(any())).thenAnswer(inv -> {
            ConsultaProcessoExecucaoEntity e = inv.getArgument(0);
            e.setId(2L);
            return e;
        });
        when(notificacaoMovimentacaoService.notificarNovidade(eq(processo), any()))
                .thenReturn(NotificacaoResultado.enviado("jr.villareal@gmail.com"));

        ResultadoMonitoramentoResponse r = service.monitorarProcesso(1076L);

        assertThat(r.isBaseline()).isFalse();
        assertThat(r.getNovas()).isEqualTo(1);
        assertThat(r.getNovasMovimentacoes()).hasSize(1);
        assertThat(r.getNovasMovimentacoes().getFirst().getIdMovi()).isEqualTo("481112538");
        assertThat(r.getStatus()).isEqualTo(StatusExecucao.SUCESSO_COM_NOVIDADE);
        verify(movimentacaoMonitoradaRepository).save(any());

        ArgumentCaptor<ConsultaProcessoExecucaoEntity> execCaptor =
                ArgumentCaptor.forClass(ConsultaProcessoExecucaoEntity.class);
        verify(consultaProcessoExecucaoRepository).save(execCaptor.capture());
        assertThat(execCaptor.getValue().getNotificacaoStatus()).isEqualTo(NotificacaoEnvioStatus.ENVIADO);
        assertThat(execCaptor.getValue().getNotificacaoDestinatarios()).isEqualTo("jr.villareal@gmail.com");
        assertThat(execCaptor.getValue().getNotificacaoEm()).isNotNull();

        ArgumentCaptor<List<MovimentacaoMonitoradaEntity>> novasCaptor = ArgumentCaptor.forClass(List.class);
        verify(notificacaoMovimentacaoService).notificarNovidade(eq(processo), novasCaptor.capture());
        assertThat(novasCaptor.getValue()).hasSize(1);
        assertThat(novasCaptor.getValue().getFirst().getIdMovi()).isEqualTo("481112538");
    }

    @Test
    void executarMonitoramento_falhaEmail_gravaFalhaESalvaExecucao() {
        ProcessoEntity processo = processo(1076L);
        when(movimentacaoMonitoradaRepository.countByProcessoId(1076L)).thenReturn(1L);
        when(movimentacaoMonitoradaRepository.findByProcessoId(1076L)).thenReturn(List.of());
        when(listagemService.listarMovimentacoesComFallbackReduzido(1L, processo.getNumeroCnj()))
                .thenReturn(List.of(mov("2", "481112538")));
        when(notificacaoMovimentacaoService.notificarNovidade(eq(processo), any()))
                .thenReturn(NotificacaoResultado.falha("a@b.com", "gmail down"));
        when(consultaProcessoExecucaoRepository.save(any())).thenAnswer(inv -> {
            ConsultaProcessoExecucaoEntity e = inv.getArgument(0);
            e.setId(6L);
            return e;
        });

        ResultadoMonitoramentoResponse r =
                service.executarMonitoramento(processo, OrigemConsulta.MANUAL, null);

        assertThat(r.getStatus()).isEqualTo(StatusExecucao.SUCESSO_COM_NOVIDADE);
        ArgumentCaptor<ConsultaProcessoExecucaoEntity> cap = ArgumentCaptor.forClass(ConsultaProcessoExecucaoEntity.class);
        verify(consultaProcessoExecucaoRepository).save(cap.capture());
        assertThat(cap.getValue().getNotificacaoStatus()).isEqualTo(NotificacaoEnvioStatus.FALHA);
        assertThat(cap.getValue().getNotificacaoErro()).contains("gmail down");
    }

    @Test
    void executarMonitoramento_semDestinatarioEmail_gravaSemDestinatario() {
        ProcessoEntity processo = processo(1076L);
        when(movimentacaoMonitoradaRepository.countByProcessoId(1076L)).thenReturn(1L);
        when(movimentacaoMonitoradaRepository.findByProcessoId(1076L)).thenReturn(List.of());
        when(listagemService.listarMovimentacoesComFallbackReduzido(1L, processo.getNumeroCnj()))
                .thenReturn(List.of(mov("2", "481112538")));
        when(notificacaoMovimentacaoService.notificarNovidade(eq(processo), any()))
                .thenReturn(NotificacaoResultado.semDestinatario());
        when(consultaProcessoExecucaoRepository.save(any())).thenAnswer(inv -> {
            ConsultaProcessoExecucaoEntity e = inv.getArgument(0);
            e.setId(7L);
            return e;
        });

        service.executarMonitoramento(processo, OrigemConsulta.MANUAL, null);

        ArgumentCaptor<ConsultaProcessoExecucaoEntity> cap = ArgumentCaptor.forClass(ConsultaProcessoExecucaoEntity.class);
        verify(consultaProcessoExecucaoRepository).save(cap.capture());
        assertThat(cap.getValue().getNotificacaoStatus()).isEqualTo(NotificacaoEnvioStatus.SEM_DESTINATARIO);
    }

    @Test
    void executarMonitoramento_semNovas_naoNotifica() {
        ProcessoEntity processo = processo(1076L);
        MovimentacaoMonitoradaEntity existente = new MovimentacaoMonitoradaEntity();
        existente.setIdMovi("481112537");
        MovimentacaoMonitoradaEntity existente2 = new MovimentacaoMonitoradaEntity();
        existente2.setIdMovi("481112538");

        when(movimentacaoMonitoradaRepository.countByProcessoId(1076L)).thenReturn(2L);
        when(movimentacaoMonitoradaRepository.findByProcessoId(1076L))
                .thenReturn(List.of(existente, existente2));
        when(listagemService.listarMovimentacoesComFallbackReduzido(1L, processo.getNumeroCnj()))
                .thenReturn(List.of(mov("1", "481112537"), mov("2", "481112538")));
        when(consultaProcessoExecucaoRepository.save(any())).thenAnswer(inv -> {
            ConsultaProcessoExecucaoEntity e = inv.getArgument(0);
            e.setId(3L);
            return e;
        });

        ResultadoMonitoramentoResponse r =
                service.executarMonitoramento(processo, OrigemConsulta.MANUAL, null);

        assertThat(r.getNovas()).isZero();
        verify(notificacaoMovimentacaoService, org.mockito.Mockito.never())
                .notificarNovidade(any(), any());
        ArgumentCaptor<ConsultaProcessoExecucaoEntity> cap = ArgumentCaptor.forClass(ConsultaProcessoExecucaoEntity.class);
        verify(consultaProcessoExecucaoRepository).save(cap.capture());
        assertThat(cap.getValue().getNotificacaoStatus()).isEqualTo(NotificacaoEnvioStatus.NAO_APLICAVEL);
    }

    private static ProcessoEntity processo(long id) {
        ProcessoEntity p = new ProcessoEntity();
        p.setId(id);
        p.setNumeroCnj("5059346-36.2026.8.09.0007");
        return p;
    }

    private static MovimentacaoProjudi mov(String numero, String idMovi) {
        return new MovimentacaoProjudi(
                numero,
                "Tipo " + numero,
                "Desc " + numero,
                "28/05/2026 17:29:47",
                "usuario",
                "movi_cod",
                idMovi,
                null,
                true);
    }
}
