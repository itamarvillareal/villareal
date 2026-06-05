package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.api.dto.AgendamentoRequest;
import br.com.vilareal.agendamento.api.dto.AgendamentoResponse;
import br.com.vilareal.agendamento.api.dto.ConsultaPeriodicaHabilitadaDto;
import br.com.vilareal.agendamento.api.dto.ExecucaoResponse;
import br.com.vilareal.agendamento.api.dto.PainelItemResponse;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.ConsultaProcessoExecucaoEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.AgendamentoConsultaRepository;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.ConsultaProcessoExecucaoRepository;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AgendamentoConsultaApplicationService {

    private static final int TOLERANCIA_ATRASO_MINUTOS = 1;

    private final AgendamentoConsultaRepository agendamentoConsultaRepository;
    private final ConsultaProcessoExecucaoRepository consultaProcessoExecucaoRepository;
    private final ProcessoRepository processoRepository;
    private final Clock clock;

    public AgendamentoConsultaApplicationService(
            AgendamentoConsultaRepository agendamentoConsultaRepository,
            ConsultaProcessoExecucaoRepository consultaProcessoExecucaoRepository,
            ProcessoRepository processoRepository,
            Clock clock) {
        this.agendamentoConsultaRepository = agendamentoConsultaRepository;
        this.consultaProcessoExecucaoRepository = consultaProcessoExecucaoRepository;
        this.processoRepository = processoRepository;
        this.clock = clock;
    }

    private LocalDateTime agora() {
        return clock.instant().atZone(clock.getZone()).toLocalDateTime();
    }

    @Transactional
    public AgendamentoResponse criar(Long processoId, AgendamentoRequest request) {
        ProcessoEntity processo = carregarProcesso(processoId);
        AgendamentoProximaExecucaoCalculo.validarCadencia(
                request.getTipoCadencia(),
                request.getIntervaloMinutos(),
                request.getHorariosFixos(),
                request.getPeriodo(),
                request.getPeriodoHorario());

        AgendamentoConsultaEntity entity = new AgendamentoConsultaEntity();
        entity.setProcesso(processo);
        aplicarRequest(entity, request);
        entity.setAtivo(true);
        entity.setProximaExecucao(AgendamentoProximaExecucaoCalculo.calcularProxima(entity, agora()));
        entity = agendamentoConsultaRepository.save(entity);
        return toResponse(entity);
    }

    @Transactional(readOnly = true)
    public List<AgendamentoResponse> listarPorProcesso(Long processoId) {
        if (!processoRepository.existsById(processoId)) {
            throw new ResourceNotFoundException("Processo não encontrado: " + processoId);
        }
        return agendamentoConsultaRepository.findByProcessoId(processoId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public AgendamentoResponse editar(Long id, AgendamentoRequest request) {
        AgendamentoConsultaEntity entity = carregarAgendamento(id);
        AgendamentoProximaExecucaoCalculo.validarCadencia(
                request.getTipoCadencia(),
                request.getIntervaloMinutos(),
                request.getHorariosFixos(),
                request.getPeriodo(),
                request.getPeriodoHorario());
        aplicarRequest(entity, request);
        entity.setProximaExecucao(AgendamentoProximaExecucaoCalculo.calcularProxima(entity, agora()));
        return toResponse(agendamentoConsultaRepository.save(entity));
    }

    @Transactional
    public AgendamentoResponse pausar(Long id) {
        AgendamentoConsultaEntity entity = carregarAgendamento(id);
        entity.setAtivo(false);
        return toResponse(agendamentoConsultaRepository.save(entity));
    }

    @Transactional
    public AgendamentoResponse retomar(Long id) {
        AgendamentoConsultaEntity entity = carregarAgendamento(id);
        entity.setAtivo(true);
        entity.setProximaExecucao(AgendamentoProximaExecucaoCalculo.calcularProxima(entity, agora()));
        return toResponse(agendamentoConsultaRepository.save(entity));
    }

    @Transactional
    public void remover(Long id) {
        AgendamentoConsultaEntity entity = carregarAgendamento(id);
        agendamentoConsultaRepository.delete(entity);
    }

    @Transactional(readOnly = true)
    public Page<ExecucaoResponse> listarExecucoesPorProcesso(Long processoId, Pageable pageable) {
        if (!processoRepository.existsById(processoId)) {
            throw new ResourceNotFoundException("Processo não encontrado: " + processoId);
        }
        return consultaProcessoExecucaoRepository
                .findByProcessoIdOrderByIniciadaEmDesc(processoId, pageable)
                .map(this::toExecucaoResponse);
    }

    @Transactional(readOnly = true)
    public Page<ExecucaoResponse> listarExecucoesPorAgendamento(Long agendamentoId, Pageable pageable) {
        if (!agendamentoConsultaRepository.existsById(agendamentoId)) {
            throw new ResourceNotFoundException("Agendamento não encontrado: " + agendamentoId);
        }
        return consultaProcessoExecucaoRepository
                .findByAgendamentoIdOrderByIniciadaEmDesc(agendamentoId, pageable)
                .map(this::toExecucaoResponse);
    }

    @Transactional(readOnly = true)
    public ConsultaPeriodicaHabilitadaDto obterConsultaPeriodicaHabilitada(Long processoId) {
        ProcessoEntity processo = carregarProcesso(processoId);
        return new ConsultaPeriodicaHabilitadaDto(Boolean.TRUE.equals(processo.getConsultaPeriodicaHabilitada()));
    }

    @Transactional
    public ConsultaPeriodicaHabilitadaDto atualizarConsultaPeriodicaHabilitada(
            Long processoId, boolean habilitada) {
        ProcessoEntity processo = carregarProcesso(processoId);
        processo.setConsultaPeriodicaHabilitada(habilitada);
        processoRepository.save(processo);
        return new ConsultaPeriodicaHabilitadaDto(habilitada);
    }

    @Transactional(readOnly = true)
    public List<PainelItemResponse> montarPainel() {
        LocalDateTime agora = agora();
        return agendamentoConsultaRepository.findByAtivoTrueComProcesso().stream()
                .map(a -> toPainelItem(a, agora))
                .sorted(AgendamentoConsultaApplicationService::compararPainelItens)
                .collect(Collectors.toList());
    }

    private PainelItemResponse toPainelItem(AgendamentoConsultaEntity agendamento, LocalDateTime agora) {
        ProcessoEntity processo = agendamento.getProcesso();
        var ultimaExec = consultaProcessoExecucaoRepository
                .findFirstByAgendamento_IdOrderByIniciadaEmDesc(agendamento.getId())
                .orElse(null);
        boolean semNunca = ultimaExec == null;
        LocalDateTime proxima = agendamento.getProximaExecucao();
        boolean emAtraso = proxima != null && proxima.isBefore(agora.minusMinutes(TOLERANCIA_ATRASO_MINUTOS));

        return PainelItemResponse.builder()
                .agendamentoId(agendamento.getId())
                .processoId(processo.getId())
                .numeroCnj(processo.getNumeroCnj())
                .cliente(resolverNomeCliente(processo))
                .tipoCadencia(agendamento.getTipoCadencia())
                .cadenciaResumida(AgendamentoProximaExecucaoCalculo.resumoCadencia(agendamento))
                .proximaExecucao(proxima)
                .ultimaExecucao(agendamento.getUltimaExecucao())
                .statusUltimaExecucao(ultimaExec != null ? ultimaExec.getStatus() : null)
                .falhasConsecutivas(
                        agendamento.getFalhasConsecutivas() != null ? agendamento.getFalhasConsecutivas() : 0)
                .ultimoErro(agendamento.getUltimoErro())
                .ultimaFalhaEm(agendamento.getUltimaFalhaEm())
                .emAtraso(emAtraso)
                .semNunca(semNunca)
                .build();
    }

    private static int compararPainelItens(PainelItemResponse a, PainelItemResponse b) {
        int falhaA = a.getFalhasConsecutivas() > 0 ? 0 : 1;
        int falhaB = b.getFalhasConsecutivas() > 0 ? 0 : 1;
        if (falhaA != falhaB) {
            return Integer.compare(falhaA, falhaB);
        }
        if (a.isEmAtraso() != b.isEmAtraso()) {
            return a.isEmAtraso() ? -1 : 1;
        }
        return Comparator.comparing(
                        PainelItemResponse::getProximaExecucao, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(PainelItemResponse::getAgendamentoId)
                .compare(a, b);
    }

    private void aplicarRequest(AgendamentoConsultaEntity entity, AgendamentoRequest request) {
        entity.setTipoCadencia(request.getTipoCadencia());
        if (request.getTipoCadencia() == TipoCadencia.INTERVALO) {
            entity.setIntervaloMinutos(request.getIntervaloMinutos());
            entity.setHorariosFixos(null);
            entity.setPeriodo(null);
            entity.setPeriodoHorario(null);
        } else if (request.getTipoCadencia() == TipoCadencia.PERIODICO) {
            entity.setIntervaloMinutos(null);
            entity.setHorariosFixos(null);
            entity.setPeriodo(request.getPeriodo());
            entity.setPeriodoHorario(request.getPeriodoHorario());
        } else {
            entity.setIntervaloMinutos(null);
            entity.setHorariosFixos(normalizarHorariosFixos(request.getHorariosFixos()));
            entity.setPeriodo(null);
            entity.setPeriodoHorario(null);
        }
        entity.setJanelaInicio(request.getJanelaInicio());
        entity.setJanelaFim(request.getJanelaFim());
        entity.setApenasDiasUteis(Boolean.TRUE.equals(request.getApenasDiasUteis()));
        entity.setConsiderarFeriados(Boolean.TRUE.equals(request.getConsiderarFeriados()));
        entity.setValidoAte(request.getValidoAte());
        entity.setPrioridade(request.getPrioridade() != null ? request.getPrioridade() : 0);
        entity.setMotivo(request.getMotivo());
    }

    private static String normalizarHorariosFixos(String horariosFixos) {
        if (!StringUtils.hasText(horariosFixos)) {
            return horariosFixos;
        }
        return AgendamentoProximaExecucaoCalculo.parseHorariosFixos(horariosFixos).stream()
                .map(t -> t.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")))
                .collect(Collectors.joining(","));
    }

    private ProcessoEntity carregarProcesso(Long processoId) {
        return processoRepository
                .findByIdWithClienteAndPessoa(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
    }

    private AgendamentoConsultaEntity carregarAgendamento(Long id) {
        return agendamentoConsultaRepository
                .findByIdWithProcesso(id)
                .orElseThrow(() -> new ResourceNotFoundException("Agendamento não encontrado: " + id));
    }

    private AgendamentoResponse toResponse(AgendamentoConsultaEntity entity) {
        ProcessoEntity processo = entity.getProcesso();
        return AgendamentoResponse.builder()
                .id(entity.getId())
                .processoId(processo.getId())
                .numeroCnj(processo.getNumeroCnj())
                .ativo(Boolean.TRUE.equals(entity.getAtivo()))
                .tipoCadencia(entity.getTipoCadencia())
                .intervaloMinutos(entity.getIntervaloMinutos())
                .horariosFixos(entity.getHorariosFixos())
                .periodo(entity.getPeriodo())
                .periodoHorario(entity.getPeriodoHorario())
                .janelaInicio(entity.getJanelaInicio())
                .janelaFim(entity.getJanelaFim())
                .apenasDiasUteis(Boolean.TRUE.equals(entity.getApenasDiasUteis()))
                .considerarFeriados(Boolean.TRUE.equals(entity.getConsiderarFeriados()))
                .proximaExecucao(entity.getProximaExecucao())
                .ultimaExecucao(entity.getUltimaExecucao())
                .falhasConsecutivas(entity.getFalhasConsecutivas() != null ? entity.getFalhasConsecutivas() : 0)
                .ultimoErro(entity.getUltimoErro())
                .ultimaFalhaEm(entity.getUltimaFalhaEm())
                .validoAte(entity.getValidoAte())
                .prioridade(entity.getPrioridade() != null ? entity.getPrioridade() : 0)
                .motivo(entity.getMotivo())
                .criadoPor(entity.getCriadoPor())
                .criadoEm(entity.getCriadoEm())
                .atualizadoEm(entity.getAtualizadoEm())
                .build();
    }

    private ExecucaoResponse toExecucaoResponse(ConsultaProcessoExecucaoEntity entity) {
        Long agendamentoId = entity.getAgendamento() != null ? entity.getAgendamento().getId() : null;
        return ExecucaoResponse.builder()
                .id(entity.getId())
                .processoId(entity.getProcesso().getId())
                .agendamentoId(agendamentoId)
                .origem(entity.getOrigem())
                .iniciadaEm(entity.getIniciadaEm())
                .finalizadaEm(entity.getFinalizadaEm())
                .duracaoMs(entity.getDuracaoMs())
                .status(entity.getStatus())
                .teoresNovos(entity.getTeoresNovos())
                .teoresJaExistentes(entity.getTeoresJaExistentes())
                .arquivosBaixados(entity.getArquivosBaixados())
                .erro(entity.getErro())
                .detalhes(entity.getDetalhes())
                .build();
    }

    private static String resolverNomeCliente(ProcessoEntity processo) {
        ClienteEntity cliente = processo.getCliente();
        if (cliente == null) {
            return null;
        }
        if (StringUtils.hasText(cliente.getNomeReferencia())) {
            return cliente.getNomeReferencia();
        }
        PessoaEntity pessoa = cliente.getPessoa();
        return pessoa != null ? pessoa.getNome() : null;
    }
}
