package br.com.vilareal.agendamento.infrastructure.persistence.repository;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.agendamento.domain.OrigemConsulta;
import br.com.vilareal.agendamento.domain.StatusExecucao;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.ConsultaProcessoExecucaoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AgendamentoConsultaRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private AgendamentoConsultaRepository agendamentoConsultaRepository;

    @Autowired
    private ConsultaProcessoExecucaoRepository consultaProcessoExecucaoRepository;

    @Autowired
    private ProcessoRepository processoRepository;

    @BeforeEach
    void limpar() {
        consultaProcessoExecucaoRepository.deleteAll();
        agendamentoConsultaRepository.deleteAll();
    }

    @Test
    @Transactional
    void salvarAgendamentoEExecucao_lerDeVolta() {
        ProcessoEntity processo = processoRepository.findAll(PageRequest.of(0, 1)).stream()
                .findFirst()
                .orElse(null);
        Assumptions.assumeTrue(processo != null, "banco de teste sem processo");

        AgendamentoConsultaEntity agendamento = new AgendamentoConsultaEntity();
        agendamento.setProcesso(processo);
        agendamento.setTipoCadencia(TipoCadencia.INTERVALO);
        agendamento.setIntervaloMinutos(60);
        agendamento.setProximaExecucao(LocalDateTime.now().minusMinutes(5));
        agendamento.setCriadoPor("teste");
        agendamento = agendamentoConsultaRepository.saveAndFlush(agendamento);

        ConsultaProcessoExecucaoEntity execucao = new ConsultaProcessoExecucaoEntity();
        execucao.setProcesso(processo);
        execucao.setAgendamento(agendamento);
        execucao.setOrigem(OrigemConsulta.AGENDADA);
        execucao.setIniciadaEm(LocalDateTime.now());
        execucao.setStatus(StatusExecucao.SUCESSO_SEM_NOVIDADE);
        execucao.setTeoresNovos(0);
        execucao.setTeoresJaExistentes(2);
        execucao = consultaProcessoExecucaoRepository.saveAndFlush(execucao);

        assertThat(agendamento.getId()).isNotNull();
        assertThat(agendamento.getCriadoEm()).isNotNull();

        List<AgendamentoConsultaEntity> porProcesso =
                agendamentoConsultaRepository.findByProcessoId(processo.getId());
        assertThat(porProcesso).hasSize(1);
        assertThat(porProcesso.getFirst().getIntervaloMinutos()).isEqualTo(60);

        List<AgendamentoConsultaEntity> vencidos =
                agendamentoConsultaRepository.findVencidos(LocalDateTime.now());
        assertThat(vencidos).extracting(AgendamentoConsultaEntity::getId).contains(agendamento.getId());

        var pageExec = consultaProcessoExecucaoRepository.findByProcessoIdOrderByIniciadaEmDesc(
                processo.getId(), PageRequest.of(0, 10));
        assertThat(pageExec.getContent()).hasSize(1);
        assertThat(pageExec.getContent().getFirst().getId()).isEqualTo(execucao.getId());

        var pagePorAgend = consultaProcessoExecucaoRepository.findByAgendamentoIdOrderByIniciadaEmDesc(
                agendamento.getId(), PageRequest.of(0, 10));
        assertThat(pagePorAgend.getContent()).hasSize(1);
    }
}
