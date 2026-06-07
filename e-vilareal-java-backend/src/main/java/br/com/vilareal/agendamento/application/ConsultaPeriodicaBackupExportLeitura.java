package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.domain.PeriodoCadencia;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.AgendamentoConsultaRepository;
import br.com.vilareal.notificacao.domain.CanalNotificacao;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import br.com.vilareal.notificacao.infrastructure.persistence.repository.NotificacaoDestinatarioRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ConsultaPeriodicaBackupExportLeitura {

    private final ProcessoRepository processoRepository;
    private final AgendamentoConsultaRepository agendamentoConsultaRepository;
    private final NotificacaoDestinatarioRepository notificacaoDestinatarioRepository;

    public ConsultaPeriodicaBackupExportLeitura(
            ProcessoRepository processoRepository,
            AgendamentoConsultaRepository agendamentoConsultaRepository,
            NotificacaoDestinatarioRepository notificacaoDestinatarioRepository) {
        this.processoRepository = processoRepository;
        this.agendamentoConsultaRepository = agendamentoConsultaRepository;
        this.notificacaoDestinatarioRepository = notificacaoDestinatarioRepository;
    }

    @Transactional(readOnly = true)
    public List<Long> listarIdsComConfig() {
        return processoRepository.findIdsComConfigConsultaPeriodica();
    }

    @Transactional(readOnly = true)
    public List<DadosProcessoExport> carregarPorIds(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }

        Map<Long, ProcessoEntity> processosPorId = new HashMap<>();
        for (ProcessoEntity processo : processoRepository.findByIdInWithClienteAndPessoa(ids)) {
            processosPorId.put(processo.getId(), processo);
        }

        Map<Long, List<DadosAgendamentoExport>> agendamentosPorProcesso = new HashMap<>();
        for (AgendamentoConsultaEntity ag : agendamentoConsultaRepository.findByProcessoIdIn(ids)) {
            Long processoId = ag.getProcesso().getId();
            agendamentosPorProcesso
                    .computeIfAbsent(processoId, k -> new ArrayList<>())
                    .add(toAgendamentoExport(ag));
        }

        Map<Long, List<DadosDestinatarioExport>> destinatariosPorProcesso = new HashMap<>();
        for (NotificacaoDestinatarioEntity dest : notificacaoDestinatarioRepository.findByProcessoIdIn(ids)) {
            Long processoId = dest.getProcesso().getId();
            destinatariosPorProcesso
                    .computeIfAbsent(processoId, k -> new ArrayList<>())
                    .add(toDestinatarioExport(dest));
        }

        List<DadosProcessoExport> resultado = new ArrayList<>();
        for (Long id : ids) {
            ProcessoEntity processo = processosPorId.get(id);
            if (processo == null) {
                continue;
            }
            resultado.add(new DadosProcessoExport(
                    processo.getNumeroCnj() != null ? processo.getNumeroCnj() : "",
                    resolverNomeCliente(processo),
                    Boolean.TRUE.equals(processo.getConsultaPeriodicaHabilitada()),
                    agendamentosPorProcesso.getOrDefault(id, List.of()),
                    destinatariosPorProcesso.getOrDefault(id, List.of())));
        }

        resultado.sort(Comparator.comparing(DadosProcessoExport::numeroCnj, String.CASE_INSENSITIVE_ORDER));
        return resultado;
    }

    @Transactional(readOnly = true)
    public List<DadosProcessoExport> carregar() {
        return carregarPorIds(listarIdsComConfig());
    }

    private static DadosAgendamentoExport toAgendamentoExport(AgendamentoConsultaEntity ag) {
        return new DadosAgendamentoExport(
                ag.getTipoCadencia(),
                ag.getIntervaloMinutos(),
                ag.getHorariosFixos(),
                ag.getPeriodo(),
                ag.getPeriodoHorario(),
                ag.getJanelaInicio(),
                ag.getJanelaFim(),
                Boolean.TRUE.equals(ag.getApenasDiasUteis()),
                Boolean.TRUE.equals(ag.getConsiderarFeriados()),
                ag.getPrioridade() != null ? ag.getPrioridade() : 0,
                ag.getMotivo() != null ? ag.getMotivo() : "",
                ag.getValidoAte(),
                Boolean.TRUE.equals(ag.getAtivo()));
    }

    private static DadosDestinatarioExport toDestinatarioExport(NotificacaoDestinatarioEntity dest) {
        return new DadosDestinatarioExport(dest.getCanal(), dest.getValor());
    }

    private static String resolverNomeCliente(ProcessoEntity processo) {
        ClienteEntity cliente = processo.getCliente();
        if (cliente == null) {
            return "";
        }
        if (StringUtils.hasText(cliente.getNomeReferencia())) {
            return cliente.getNomeReferencia();
        }
        PessoaEntity pessoa = cliente.getPessoa();
        return pessoa != null && pessoa.getNome() != null ? pessoa.getNome() : "";
    }

    public record DadosProcessoExport(
            String numeroCnj,
            String clienteNome,
            boolean consultaPeriodicaHabilitada,
            List<DadosAgendamentoExport> agendamentos,
            List<DadosDestinatarioExport> destinatarios) {}

    public record DadosAgendamentoExport(
            TipoCadencia tipoCadencia,
            Integer intervaloMinutos,
            String horariosFixos,
            PeriodoCadencia periodo,
            LocalTime periodoHorario,
            LocalTime janelaInicio,
            LocalTime janelaFim,
            boolean apenasDiasUteis,
            boolean considerarFeriados,
            int prioridade,
            String motivo,
            LocalDateTime validoAte,
            boolean ativo) {}

    public record DadosDestinatarioExport(CanalNotificacao canal, String valor) {}
}
