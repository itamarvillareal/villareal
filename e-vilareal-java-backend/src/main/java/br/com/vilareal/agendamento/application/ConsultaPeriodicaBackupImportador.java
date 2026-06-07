package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.AgendamentoConsultaRepository;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import br.com.vilareal.notificacao.infrastructure.persistence.repository.NotificacaoDestinatarioRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
class ConsultaPeriodicaBackupImportador {

    private final ProcessoRepository processoRepository;
    private final AgendamentoConsultaRepository agendamentoConsultaRepository;
    private final NotificacaoDestinatarioRepository notificacaoDestinatarioRepository;
    private final Clock clock;

    ConsultaPeriodicaBackupImportador(
            ProcessoRepository processoRepository,
            AgendamentoConsultaRepository agendamentoConsultaRepository,
            NotificacaoDestinatarioRepository notificacaoDestinatarioRepository,
            Clock clock) {
        this.processoRepository = processoRepository;
        this.agendamentoConsultaRepository = agendamentoConsultaRepository;
        this.notificacaoDestinatarioRepository = notificacaoDestinatarioRepository;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    ResultadoProcesso importarProcesso(String numeroCnj, List<LinhaProcessoCsv> linhas) {
        var processoOpt = processoRepository.findByNumeroCnj(numeroCnj);
        if (processoOpt.isEmpty()) {
            return ResultadoProcesso.pulado();
        }

        ProcessoEntity processo =
                processoRepository.findByIdWithClienteAndPessoa(processoOpt.get().getId()).orElseThrow();
        boolean habilitada = linhas.stream()
                .findFirst()
                .map(LinhaProcessoCsv::consultaPeriodicaHabilitada)
                .orElse(false);
        processo.setConsultaPeriodicaHabilitada(habilitada);
        processoRepository.save(processo);

        int destinatariosCriados = 0;
        Set<String> destVistos = new LinkedHashSet<>();
        for (LinhaProcessoCsv linha : linhas) {
            for (ConsultaPeriodicaCsvUtil.DestinatarioCsv dest : linha.destinatarios()) {
                String chave = dest.canal().name() + ":" + dest.valor();
                if (!destVistos.add(chave)) {
                    continue;
                }
                if (!notificacaoDestinatarioRepository.existsByProcesso_IdAndCanalAndValor(
                        processo.getId(), dest.canal(), dest.valor())) {
                    NotificacaoDestinatarioEntity entidade = new NotificacaoDestinatarioEntity();
                    entidade.setProcesso(processo);
                    entidade.setCanal(dest.canal());
                    entidade.setValor(dest.valor());
                    entidade.setAtivo(true);
                    notificacaoDestinatarioRepository.save(entidade);
                    destinatariosCriados++;
                }
            }
        }

        List<AgendamentoConsultaEntity> existentes = agendamentoConsultaRepository.findByProcessoId(processo.getId());
        LocalDateTime agora = clock.instant().atZone(clock.getZone()).toLocalDateTime();
        int agendamentosCriados = 0;

        for (LinhaProcessoCsv linha : linhas) {
            if (linha.agendamento() == null) {
                continue;
            }
            ConsultaPeriodicaCsvUtil.LinhaAgendamentoCsv ag = linha.agendamento();
            boolean jaExiste = existentes.stream().anyMatch(e -> ConsultaPeriodicaCsvUtil.agendamentosEquivalentes(e, ag));
            if (jaExiste) {
                continue;
            }
            AgendamentoConsultaEntity entity = new AgendamentoConsultaEntity();
            entity.setProcesso(processo);
            entity.setTipoCadencia(ag.tipoCadencia());
            entity.setIntervaloMinutos(ag.intervaloMinutos());
            entity.setHorariosFixos(ag.horariosFixos());
            entity.setPeriodo(ag.periodo());
            entity.setPeriodoHorario(ag.periodoHorario());
            entity.setJanelaInicio(ag.janelaInicio());
            entity.setJanelaFim(ag.janelaFim());
            entity.setApenasDiasUteis(ag.apenasDiasUteis());
            entity.setConsiderarFeriados(ag.considerarFeriados());
            entity.setPrioridade(ag.prioridade());
            entity.setMotivo(ag.motivo());
            entity.setValidoAte(ag.validoAte());
            entity.setAtivo(ag.ativo());
            entity.setUltimaExecucao(null);
            entity.setFalhasConsecutivas(0);
            entity.setUltimoErro(null);
            entity.setUltimaFalhaEm(null);
            entity.setCriadoPor("import-csv");
            entity.setProximaExecucao(AgendamentoProximaExecucaoCalculo.calcularProxima(entity, agora));
            agendamentoConsultaRepository.save(entity);
            existentes = new ArrayList<>(existentes);
            existentes.add(entity);
            agendamentosCriados++;
        }

        return ResultadoProcesso.atualizado(agendamentosCriados, destinatariosCriados);
    }

    record ResultadoProcesso(boolean skipped, int agendamentosCriados, int destinatariosCriados) {
        static ResultadoProcesso pulado() {
            return new ResultadoProcesso(true, 0, 0);
        }

        static ResultadoProcesso atualizado(int agendamentos, int destinatarios) {
            return new ResultadoProcesso(false, agendamentos, destinatarios);
        }
    }

    record LinhaProcessoCsv(
            boolean consultaPeriodicaHabilitada,
            ConsultaPeriodicaCsvUtil.LinhaAgendamentoCsv agendamento,
            List<ConsultaPeriodicaCsvUtil.DestinatarioCsv> destinatarios) {}
}
