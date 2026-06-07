package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.AgendamentoConsultaRepository;
import br.com.vilareal.notificacao.domain.CanalNotificacao;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import br.com.vilareal.notificacao.infrastructure.persistence.repository.NotificacaoDestinatarioRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProcessoRepositoryConsultaPeriodicaExportIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ProcessoRepository processoRepository;

    @Autowired
    private AgendamentoConsultaRepository agendamentoConsultaRepository;

    @Autowired
    private NotificacaoDestinatarioRepository notificacaoDestinatarioRepository;

    private ProcessoEntity comAgendamento;
    private ProcessoEntity semConfig;
    private ProcessoEntity soHabilitada;

    @BeforeEach
    void preparar() {
        List<ProcessoEntity> amostra = processoRepository.findAll(PageRequest.of(0, 3)).getContent();
        Assumptions.assumeTrue(amostra.size() >= 3, "banco de teste precisa de ao menos 3 processos");

        comAgendamento = amostra.get(0);
        semConfig = amostra.get(1);
        soHabilitada = amostra.get(2);

        limparConfig(comAgendamento.getId());
        limparConfig(semConfig.getId());
        limparConfig(soHabilitada.getId());

        semConfig.setConsultaPeriodicaHabilitada(false);
        processoRepository.saveAndFlush(semConfig);

        soHabilitada.setConsultaPeriodicaHabilitada(true);
        processoRepository.saveAndFlush(soHabilitada);

        comAgendamento.setConsultaPeriodicaHabilitada(true);
        processoRepository.saveAndFlush(comAgendamento);

        AgendamentoConsultaEntity ag = new AgendamentoConsultaEntity();
        ag.setProcesso(comAgendamento);
        ag.setTipoCadencia(TipoCadencia.INTERVALO);
        ag.setIntervaloMinutos(30);
        ag.setProximaExecucao(LocalDateTime.now().plusHours(1));
        ag.setCriadoPor("teste-export-query");
        agendamentoConsultaRepository.saveAndFlush(ag);
    }

    @Test
    @Transactional
    void findIdsComConfigConsultaPeriodica_retornaApenasProcessosComConfig() {
        List<Long> ids = processoRepository.findIdsComConfigConsultaPeriodica();

        assertThat(ids).contains(comAgendamento.getId(), soHabilitada.getId());
        assertThat(ids).doesNotContain(semConfig.getId());
        assertThat((long) ids.size()).isLessThan(processoRepository.count());
    }

    @Test
    @Transactional
    void findIdsComConfigConsultaPeriodica_incluiProcessoSoComDestinatario() {
        limparConfig(soHabilitada.getId());
        soHabilitada.setConsultaPeriodicaHabilitada(false);
        processoRepository.saveAndFlush(soHabilitada);

        NotificacaoDestinatarioEntity dest = new NotificacaoDestinatarioEntity();
        dest.setProcesso(soHabilitada);
        dest.setCanal(CanalNotificacao.EMAIL);
        dest.setValor("export-query@teste.com");
        dest.setAtivo(true);
        notificacaoDestinatarioRepository.saveAndFlush(dest);

        List<Long> ids = processoRepository.findIdsComConfigConsultaPeriodica();

        assertThat(ids).contains(soHabilitada.getId());
        assertThat(ids).doesNotContain(semConfig.getId());
    }

    private void limparConfig(Long processoId) {
        agendamentoConsultaRepository.findByProcessoId(processoId).forEach(agendamentoConsultaRepository::delete);
        notificacaoDestinatarioRepository.deleteByProcessoId(processoId);
    }
}
