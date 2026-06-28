package br.com.vilareal.agendamento.application;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.agendamento.domain.PeriodoCadencia;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.AgendamentoConsultaRepository;
import br.com.vilareal.notificacao.domain.CanalNotificacao;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import br.com.vilareal.notificacao.infrastructure.persistence.repository.NotificacaoDestinatarioRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ConsultaPeriodicaBackupServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ConsultaPeriodicaBackupService backupService;

    @Autowired
    private ProcessoRepository processoRepository;

    @Autowired
    private AgendamentoConsultaRepository agendamentoConsultaRepository;

    @Autowired
    private NotificacaoDestinatarioRepository notificacaoDestinatarioRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private ProcessoEntity processo;
    private String cnjUnico;
    private String cnjOriginal;

    @BeforeEach
    void preparar() {
        processo = processoRepository.findAll().stream()
                .filter(p -> p.getNumeroCnj() != null && !p.getNumeroCnj().isBlank())
                .findFirst()
                .orElse(null);
        Assumptions.assumeTrue(processo != null, "banco de teste sem processo com CNJ");

        cnjOriginal = processo.getNumeroCnj();
        cnjUnico = "9" + UUID.randomUUID().toString().replace("-", "").substring(0, 19) + ".8.09.0001";
        transactionTemplate.executeWithoutResult(status -> {
            processo.setNumeroCnj(cnjUnico);
            processoRepository.saveAndFlush(processo);
            limparConfig(processo.getId());
        });
    }

    @AfterEach
    void restaurarProcesso() {
        if (processo == null || cnjOriginal == null) {
            return;
        }
        transactionTemplate.executeWithoutResult(status -> {
            limparConfig(processo.getId());
            ProcessoEntity p = processoRepository.findById(processo.getId()).orElse(null);
            if (p != null) {
                p.setNumeroCnj(cnjOriginal);
                processoRepository.saveAndFlush(p);
            }
        });
    }

    @Test
    void roundTrip_exportarLimparImportar_recriaConfig() {
        processo.setConsultaPeriodicaHabilitada(true);
        processoRepository.saveAndFlush(processo);

        AgendamentoConsultaEntity ag1 = novoAgendamento(TipoCadencia.INTERVALO);
        ag1.setIntervaloMinutos(45);
        ag1.setProximaExecucao(LocalDateTime.now().plusHours(1));
        agendamentoConsultaRepository.saveAndFlush(ag1);

        AgendamentoConsultaEntity ag2 = novoAgendamento(TipoCadencia.HORARIOS_FIXOS);
        ag2.setHorariosFixos("08:00,14:30");
        ag2.setProximaExecucao(LocalDateTime.now().plusHours(2));
        agendamentoConsultaRepository.saveAndFlush(ag2);

        NotificacaoDestinatarioEntity dest = new NotificacaoDestinatarioEntity();
        dest.setProcesso(processo);
        dest.setCanal(CanalNotificacao.EMAIL);
        dest.setValor("backup-roundtrip@teste.com");
        dest.setAtivo(true);
        notificacaoDestinatarioRepository.saveAndFlush(dest);

        byte[] csv = backupService.exportar().conteudo();
        assertThat(csv.length).isGreaterThan(100);

        transactionTemplate.executeWithoutResult(status -> limparConfig(processo.getId()));
        assertThat(agendamentoConsultaRepository.findByProcessoId(processo.getId())).isEmpty();
        assertThat(notificacaoDestinatarioRepository.findByProcessoIdOrderByCanalAscIdAsc(processo.getId()))
                .isEmpty();

        var rel = backupService.importar(new MockMultipartFile("file", "backup.csv", "text/csv", csv));

        assertThat(rel.getProcessosAtualizados()).isEqualTo(1);
        assertThat(rel.getAgendamentosCriados()).isEqualTo(2);
        assertThat(rel.getDestinatariosCriados()).isEqualTo(1);
        assertThat(rel.getPuladosCnjInexistente()).isEmpty();

        ProcessoEntity reloaded = processoRepository.findById(processo.getId()).orElseThrow();
        assertThat(reloaded.getConsultaPeriodicaHabilitada()).isTrue();

        List<AgendamentoConsultaEntity> agendamentos =
                agendamentoConsultaRepository.findByProcessoId(processo.getId());
        assertThat(agendamentos).hasSize(2);
        assertThat(agendamentos)
                .anyMatch(a -> a.getTipoCadencia() == TipoCadencia.INTERVALO && a.getIntervaloMinutos() == 45);
        assertThat(agendamentos).anyMatch(a -> a.getTipoCadencia() == TipoCadencia.HORARIOS_FIXOS
                && "08:00,14:30".equals(a.getHorariosFixos()));
        assertThat(agendamentos).allMatch(a -> a.getProximaExecucao() != null);
        assertThat(agendamentos).allMatch(a -> a.getUltimaExecucao() == null);
        assertThat(agendamentos).allMatch(a -> a.getFalhasConsecutivas() == 0);

        var dests = notificacaoDestinatarioRepository.findByProcessoIdOrderByCanalAscIdAsc(processo.getId());
        assertThat(dests).hasSize(1);
        assertThat(dests.get(0).getValor()).isEqualTo("backup-roundtrip@teste.com");

        var rel2 = backupService.importar(new MockMultipartFile("file", "backup.csv", "text/csv", csv));
        assertThat(rel2.getAgendamentosCriados()).isZero();
        assertThat(rel2.getDestinatariosCriados()).isZero();
        assertThat(agendamentoConsultaRepository.findByProcessoId(processo.getId())).hasSize(2);
    }

    @Test
    @Transactional
    void importar_cnjInexistente_noRelatorio() {
        String linha = String.join(
                ";",
                "99999999999999999999",
                "",
                "true",
                "INTERVALO",
                "30",
                "",
                "",
                "",
                "",
                "",
                "false",
                "false",
                "0",
                "",
                "",
                "true",
                "");
        String header = String.join(";", ConsultaPeriodicaBackupCsv.HEADER);
        byte[] bytes = (header + "\r\n" + linha).getBytes(StandardCharsets.UTF_8);

        var rel = backupService.importar(new MockMultipartFile("file", "x.csv", "text/csv", bytes));

        assertThat(rel.getPuladosCnjInexistente()).containsExactly("99999999999999999999");
        assertThat(rel.getProcessosAtualizados()).isZero();
    }

    private AgendamentoConsultaEntity novoAgendamento(TipoCadencia tipo) {
        AgendamentoConsultaEntity ag = new AgendamentoConsultaEntity();
        ag.setProcesso(processo);
        ag.setTipoCadencia(tipo);
        ag.setAtivo(true);
        ag.setApenasDiasUteis(false);
        ag.setConsiderarFeriados(false);
        ag.setPrioridade(0);
        if (tipo == TipoCadencia.PERIODICO) {
            ag.setPeriodo(PeriodoCadencia.DIARIO);
            ag.setPeriodoHorario(LocalTime.of(9, 0));
        }
        return ag;
    }

    private void limparConfig(Long processoId) {
        agendamentoConsultaRepository.findByProcessoId(processoId).forEach(agendamentoConsultaRepository::delete);
        notificacaoDestinatarioRepository.deleteByProcessoId(processoId);
        ProcessoEntity p = processoRepository.findById(processoId).orElseThrow();
        p.setConsultaPeriodicaHabilitada(false);
        processoRepository.saveAndFlush(p);
    }
}
