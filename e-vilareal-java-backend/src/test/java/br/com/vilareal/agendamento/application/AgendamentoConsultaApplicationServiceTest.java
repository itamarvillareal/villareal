package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.api.dto.AgendamentoRequest;
import br.com.vilareal.agendamento.domain.OrigemConsulta;
import br.com.vilareal.agendamento.domain.StatusExecucao;
import br.com.vilareal.agendamento.domain.PeriodoCadencia;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.ConsultaProcessoExecucaoEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.AgendamentoConsultaRepository;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.ConsultaProcessoExecucaoRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgendamentoConsultaApplicationServiceTest {

    @Mock
    private AgendamentoConsultaRepository agendamentoConsultaRepository;

    @Mock
    private ConsultaProcessoExecucaoRepository consultaProcessoExecucaoRepository;

    @Mock
    private ProcessoRepository processoRepository;

    @InjectMocks
    private AgendamentoConsultaApplicationService service;

    @Test
    void criar_intervalo_semeiaProximaExecucao() {
        ProcessoEntity processo = processo(1076L, "5059346-36.2026.8.09.0007");
        when(processoRepository.findByIdWithClienteAndPessoa(1076L)).thenReturn(Optional.of(processo));
        when(agendamentoConsultaRepository.save(any())).thenAnswer(inv -> {
            AgendamentoConsultaEntity e = inv.getArgument(0);
            e.setId(10L);
            return e;
        });

        AgendamentoRequest req = new AgendamentoRequest();
        req.setTipoCadencia(TipoCadencia.INTERVALO);
        req.setIntervaloMinutos(120);

        var resp = service.criar(1076L, req);

        ArgumentCaptor<AgendamentoConsultaEntity> cap = ArgumentCaptor.forClass(AgendamentoConsultaEntity.class);
        verify(agendamentoConsultaRepository).save(cap.capture());
        LocalDateTime proxima = cap.getValue().getProximaExecucao();
        assertThat(proxima).isAfter(LocalDateTime.now().plusMinutes(119));
        assertThat(proxima).isBefore(LocalDateTime.now().plusMinutes(121));
        assertThat(resp.getIntervaloMinutos()).isEqualTo(120);
        assertThat(resp.isAtivo()).isTrue();
    }

    @Test
    void criar_horariosFixos_semeiaProximoHorarioHoje() {
        ProcessoEntity processo = processo(1L, "0000001-00.2026.8.09.0001");
        when(processoRepository.findByIdWithClienteAndPessoa(1L)).thenReturn(Optional.of(processo));
        when(agendamentoConsultaRepository.save(any())).thenAnswer(inv -> {
            AgendamentoConsultaEntity e = inv.getArgument(0);
            e.setId(2L);
            return e;
        });

        AgendamentoRequest req = new AgendamentoRequest();
        req.setTipoCadencia(TipoCadencia.HORARIOS_FIXOS);
        req.setHorariosFixos("14:00,08:00");

        service.criar(1L, req);

        ArgumentCaptor<AgendamentoConsultaEntity> cap = ArgumentCaptor.forClass(AgendamentoConsultaEntity.class);
        verify(agendamentoConsultaRepository).save(cap.capture());
        assertThat(cap.getValue().getHorariosFixos()).isEqualTo("08:00,14:00");
        assertThat(cap.getValue().getProximaExecucao()).isAfter(LocalDateTime.now().minusSeconds(5));
    }

    @Test
    void criar_periodicoSemanal_semeiaProximaExecucaoEResumo() {
        ProcessoEntity processo = processo(1076L, "5059346-36.2026.8.09.0007");
        when(processoRepository.findByIdWithClienteAndPessoa(1076L)).thenReturn(Optional.of(processo));
        when(agendamentoConsultaRepository.save(any())).thenAnswer(inv -> {
            AgendamentoConsultaEntity e = inv.getArgument(0);
            e.setId(11L);
            return e;
        });

        AgendamentoRequest req = new AgendamentoRequest();
        req.setTipoCadencia(TipoCadencia.PERIODICO);
        req.setPeriodo(PeriodoCadencia.SEMANAL);
        req.setPeriodoHorario(LocalTime.of(8, 0));

        var resp = service.criar(1076L, req);

        ArgumentCaptor<AgendamentoConsultaEntity> cap = ArgumentCaptor.forClass(AgendamentoConsultaEntity.class);
        verify(agendamentoConsultaRepository).save(cap.capture());
        assertThat(cap.getValue().getPeriodo()).isEqualTo(PeriodoCadencia.SEMANAL);
        assertThat(cap.getValue().getPeriodoHorario()).isEqualTo(LocalTime.of(8, 0));
        assertThat(cap.getValue().getProximaExecucao()).isNotNull();
        assertThat(cap.getValue().getProximaExecucao().toLocalTime()).isEqualTo(LocalTime.of(8, 0));
        assertThat(resp.getPeriodo()).isEqualTo(PeriodoCadencia.SEMANAL);
        assertThat(resp.getPeriodoHorario()).isEqualTo(LocalTime.of(8, 0));
    }

    @Test
    void criar_periodicoSemPeriodo_lancaBusinessRule() {
        ProcessoEntity processo = processo(1L, "cnj");
        when(processoRepository.findByIdWithClienteAndPessoa(1L)).thenReturn(Optional.of(processo));

        AgendamentoRequest req = new AgendamentoRequest();
        req.setTipoCadencia(TipoCadencia.PERIODICO);
        req.setPeriodoHorario(LocalTime.of(8, 0));

        assertThatThrownBy(() -> service.criar(1L, req)).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void criar_intervaloInvalido_lancaBusinessRule() {
        ProcessoEntity processo = processo(1L, "cnj");
        when(processoRepository.findByIdWithClienteAndPessoa(1L)).thenReturn(Optional.of(processo));

        AgendamentoRequest req = new AgendamentoRequest();
        req.setTipoCadencia(TipoCadencia.INTERVALO);
        req.setIntervaloMinutos(0);

        assertThatThrownBy(() -> service.criar(1L, req))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("intervaloMinutos");
    }

    @Test
    void pausar_retomar_alteramAtivo() {
        AgendamentoConsultaEntity entity = agendamentoAtivo();
        when(agendamentoConsultaRepository.findByIdWithProcesso(5L)).thenReturn(Optional.of(entity));
        when(agendamentoConsultaRepository.save(entity)).thenReturn(entity);

        var pausado = service.pausar(5L);
        assertThat(pausado.isAtivo()).isFalse();

        var retomado = service.retomar(5L);
        assertThat(retomado.isAtivo()).isTrue();
        assertThat(entity.getProximaExecucao()).isNotNull();
    }

    @Test
    void atualizarConsultaPeriodicaHabilitada_persisteNoProcesso() {
        ProcessoEntity p = processo(1076L, "5059346-36.2026.8.09.0007");
        p.setConsultaPeriodicaHabilitada(true);
        when(processoRepository.findByIdWithClienteAndPessoa(1076L)).thenReturn(Optional.of(p));

        var dto = service.atualizarConsultaPeriodicaHabilitada(1076L, false);

        assertThat(dto.isHabilitada()).isFalse();
        assertThat(p.getConsultaPeriodicaHabilitada()).isFalse();
        verify(processoRepository).save(p);
    }

    @Test
    void remover_agendamento_naoInvocaDeleteExecucoes() {
        AgendamentoConsultaEntity a = agendamentoAtivo();
        when(agendamentoConsultaRepository.findByIdWithProcesso(5L)).thenReturn(Optional.of(a));

        service.remover(5L);

        verify(agendamentoConsultaRepository).delete(a);
        verify(consultaProcessoExecucaoRepository, never()).deleteAll(any());
        verify(consultaProcessoExecucaoRepository, never()).delete(any());
    }

    @Test
    void montarPainel_semExecucao_semNuncaTrue() {
        AgendamentoConsultaEntity a = agendamentoAtivo();
        a.setProximaExecucao(LocalDateTime.now().plusHours(2));
        when(agendamentoConsultaRepository.findByAtivoTrueComProcesso()).thenReturn(List.of(a));
        when(consultaProcessoExecucaoRepository.findFirstByAgendamento_IdOrderByIniciadaEmDesc(5L))
                .thenReturn(Optional.empty());

        var painel = service.montarPainel();

        assertThat(painel).hasSize(1);
        assertThat(painel.getFirst().isSemNunca()).isTrue();
        assertThat(painel.getFirst().isEmAtraso()).isFalse();
        assertThat(painel.getFirst().getStatusUltimaExecucao()).isNull();
    }

    @Test
    void montarPainel_comUltimaExecucao_preencheStatus() {
        AgendamentoConsultaEntity a = agendamentoAtivo();
        a.setProximaExecucao(LocalDateTime.now().plusHours(1));
        ConsultaProcessoExecucaoEntity exec = new ConsultaProcessoExecucaoEntity();
        exec.setStatus(StatusExecucao.SUCESSO_SEM_NOVIDADE);
        exec.setOrigem(OrigemConsulta.AGENDADA);
        exec.setIniciadaEm(LocalDateTime.now().minusDays(1));

        when(agendamentoConsultaRepository.findByAtivoTrueComProcesso()).thenReturn(List.of(a));
        when(consultaProcessoExecucaoRepository.findFirstByAgendamento_IdOrderByIniciadaEmDesc(5L))
                .thenReturn(Optional.of(exec));

        var item = service.montarPainel().getFirst();

        assertThat(item.isSemNunca()).isFalse();
        assertThat(item.getStatusUltimaExecucao()).isEqualTo(StatusExecucao.SUCESSO_SEM_NOVIDADE);
    }

    @Test
    void montarPainel_comFalhas_preencheCamposRetry() {
        AgendamentoConsultaEntity a = agendamentoAtivo();
        a.setProximaExecucao(LocalDateTime.now().plusHours(1));
        a.setFalhasConsecutivas(3);
        a.setUltimoErro("Token OTP não recebido no prazo.");
        a.setUltimaFalhaEm(LocalDateTime.of(2026, 6, 4, 15, 30));

        when(agendamentoConsultaRepository.findByAtivoTrueComProcesso()).thenReturn(List.of(a));
        when(consultaProcessoExecucaoRepository.findFirstByAgendamento_IdOrderByIniciadaEmDesc(5L))
                .thenReturn(Optional.empty());

        var item = service.montarPainel().getFirst();

        assertThat(item.getFalhasConsecutivas()).isEqualTo(3);
        assertThat(item.getUltimoErro()).contains("OTP");
        assertThat(item.getUltimaFalhaEm()).isEqualTo(LocalDateTime.of(2026, 6, 4, 15, 30));
    }

    @Test
    void montarPainel_ordenacaoFalhaAntesDeAtraso() {
        AgendamentoConsultaEntity ok = agendamentoAtivo();
        ok.setId(1L);
        ok.setProximaExecucao(LocalDateTime.now().minusHours(2));

        AgendamentoConsultaEntity falhando = agendamentoAtivo();
        falhando.setId(2L);
        falhando.setProximaExecucao(LocalDateTime.now().plusDays(1));
        falhando.setFalhasConsecutivas(2);
        falhando.setUltimoErro("erro");

        when(agendamentoConsultaRepository.findByAtivoTrueComProcesso()).thenReturn(List.of(ok, falhando));
        when(consultaProcessoExecucaoRepository.findFirstByAgendamento_IdOrderByIniciadaEmDesc(1L))
                .thenReturn(Optional.empty());
        when(consultaProcessoExecucaoRepository.findFirstByAgendamento_IdOrderByIniciadaEmDesc(2L))
                .thenReturn(Optional.empty());

        var painel = service.montarPainel();

        assertThat(painel).hasSize(2);
        assertThat(painel.getFirst().getAgendamentoId()).isEqualTo(2L);
        assertThat(painel.getFirst().getFalhasConsecutivas()).isEqualTo(2);
    }

    private static ProcessoEntity processo(long id, String cnj) {
        ProcessoEntity p = new ProcessoEntity();
        p.setId(id);
        p.setNumeroCnj(cnj);
        p.setNumeroInterno(1);
        return p;
    }

    private static AgendamentoConsultaEntity agendamentoAtivo() {
        AgendamentoConsultaEntity a = new AgendamentoConsultaEntity();
        a.setId(5L);
        a.setProcesso(processo(1076L, "5059346-36.2026.8.09.0007"));
        a.setAtivo(true);
        a.setTipoCadencia(TipoCadencia.INTERVALO);
        a.setIntervaloMinutos(60);
        a.setPrioridade(0);
        return a;
    }
}
