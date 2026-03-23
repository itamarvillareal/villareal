package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.TarefaOperacionalRequest;
import br.com.vilareal.api.dto.TarefaOperacionalResponse;
import br.com.vilareal.api.dto.TarefaOperacionalStatusPatchRequest;
import br.com.vilareal.api.entity.*;
import br.com.vilareal.api.entity.enums.TarefaOperacionalOrigem;
import br.com.vilareal.api.entity.enums.TarefaOperacionalPrioridade;
import br.com.vilareal.api.entity.enums.TarefaOperacionalStatus;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.*;
import br.com.vilareal.api.service.TarefaOperacionalService;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TarefaOperacionalServiceImpl implements TarefaOperacionalService {
    private final TarefaOperacionalRepository tarefaRepository;
    private final TarefaOperacionalHistoricoRepository historicoRepository;
    private final UsuarioRepository usuarioRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final PublicacaoRepository publicacaoRepository;
    private final AgendaEventoRepository agendaEventoRepository;
    private final ProcessoPrazoRepository processoPrazoRepository;

    public TarefaOperacionalServiceImpl(
            TarefaOperacionalRepository tarefaRepository,
            TarefaOperacionalHistoricoRepository historicoRepository,
            UsuarioRepository usuarioRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            PublicacaoRepository publicacaoRepository,
            AgendaEventoRepository agendaEventoRepository,
            ProcessoPrazoRepository processoPrazoRepository
    ) {
        this.tarefaRepository = tarefaRepository;
        this.historicoRepository = historicoRepository;
        this.usuarioRepository = usuarioRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.publicacaoRepository = publicacaoRepository;
        this.agendaEventoRepository = agendaEventoRepository;
        this.processoPrazoRepository = processoPrazoRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TarefaOperacionalResponse> listar(
            Long responsavelUsuarioId,
            TarefaOperacionalStatus status,
            TarefaOperacionalPrioridade prioridade,
            Long clienteId,
            Long processoId,
            LocalDate dataLimiteDe,
            LocalDate dataLimiteAte
    ) {
        Specification<TarefaOperacional> spec = comFiltros(
                responsavelUsuarioId, status, prioridade, clienteId, processoId, dataLimiteDe, dataLimiteAte
        );
        return tarefaRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "id")).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private static Specification<TarefaOperacional> comFiltros(
            Long responsavelUsuarioId,
            TarefaOperacionalStatus status,
            TarefaOperacionalPrioridade prioridade,
            Long clienteId,
            Long processoId,
            LocalDate dataLimiteDe,
            LocalDate dataLimiteAte
    ) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (responsavelUsuarioId != null) {
                p.add(cb.equal(root.get("responsavel").get("id"), responsavelUsuarioId));
            }
            if (status != null) {
                p.add(cb.equal(root.get("status"), status));
            }
            if (prioridade != null) {
                p.add(cb.equal(root.get("prioridade"), prioridade));
            }
            if (clienteId != null) {
                p.add(cb.equal(root.get("cliente").get("id"), clienteId));
            }
            if (processoId != null) {
                p.add(cb.equal(root.get("processo").get("id"), processoId));
            }
            if (dataLimiteDe != null) {
                p.add(cb.greaterThanOrEqualTo(root.get("dataLimite"), dataLimiteDe));
            }
            if (dataLimiteAte != null) {
                p.add(cb.lessThanOrEqualTo(root.get("dataLimite"), dataLimiteAte));
            }
            if (p.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(p.toArray(new Predicate[0]));
        };
    }

    @Override
    @Transactional(readOnly = true)
    public TarefaOperacionalResponse buscar(Long id) {
        return toResponse(getOrFail(id));
    }

    @Override
    @Transactional
    public TarefaOperacionalResponse criar(TarefaOperacionalRequest request) {
        TarefaOperacional e = new TarefaOperacional();
        aplicar(e, request, true);
        return toResponse(tarefaRepository.save(e));
    }

    @Override
    @Transactional
    public TarefaOperacionalResponse atualizar(Long id, TarefaOperacionalRequest request) {
        TarefaOperacional e = getOrFail(id);
        aplicar(e, request, false);
        return toResponse(tarefaRepository.save(e));
    }

    @Override
    @Transactional
    public TarefaOperacionalResponse alterarStatus(Long id, TarefaOperacionalStatusPatchRequest request) {
        TarefaOperacional e = getOrFail(id);
        TarefaOperacionalStatus anterior = e.getStatus();
        TarefaOperacionalStatus novo = request.getStatus();
        if (anterior == novo && request.getObservacaoConclusao() == null) {
            return toResponse(e);
        }
        e.setStatus(novo);
        if (request.getObservacaoConclusao() != null) {
            e.setObservacaoConclusao(request.getObservacaoConclusao());
        }
        if (novo == TarefaOperacionalStatus.CONCLUIDA) {
            e.setDataConclusao(LocalDateTime.now());
        } else if (anterior == TarefaOperacionalStatus.CONCLUIDA && novo != TarefaOperacionalStatus.CONCLUIDA) {
            e.setDataConclusao(null);
        }
        TarefaOperacional salvo = tarefaRepository.save(e);
        if (anterior != novo) {
            TarefaOperacionalHistorico h = new TarefaOperacionalHistorico();
            h.setTarefa(salvo);
            h.setTipo("STATUS_ALTERADO");
            h.setStatusAnterior(anterior != null ? anterior.name() : null);
            h.setStatusNovo(novo != null ? novo.name() : null);
            h.setDetalhe(request.getObservacaoConclusao());
            historicoRepository.save(h);
        }
        return toResponse(salvo);
    }

    private TarefaOperacional getOrFail(Long id) {
        return tarefaRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Tarefa não encontrada: " + id));
    }

    private void aplicar(TarefaOperacional e, TarefaOperacionalRequest r, boolean criacao) {
        e.setTitulo(r.getTitulo().trim());
        e.setDescricao(r.getDescricao());
        if (r.getStatus() != null) {
            e.setStatus(r.getStatus());
        } else if (criacao) {
            e.setStatus(TarefaOperacionalStatus.PENDENTE);
        }
        if (r.getPrioridade() != null) {
            e.setPrioridade(r.getPrioridade());
        } else if (criacao) {
            e.setPrioridade(TarefaOperacionalPrioridade.NORMAL);
        }
        if (r.getOrigem() != null) {
            e.setOrigem(r.getOrigem());
        } else if (criacao) {
            e.setOrigem(TarefaOperacionalOrigem.MANUAL);
        }
        e.setResponsavel(resolveUsuario(r.getResponsavelUsuarioId()));
        e.setCriador(resolveUsuario(r.getCriadorUsuarioId()));
        e.setCliente(resolveCliente(r.getClienteId()));
        Processo processo = resolveProcesso(r.getProcessoId());
        e.setProcesso(processo);
        e.setPublicacao(resolvePublicacao(r.getPublicacaoId()));
        e.setAgendaEvento(resolveAgenda(r.getAgendaEventoId()));
        ProcessoPrazo prazo = resolvePrazo(r.getProcessoPrazoId());
        e.setProcessoPrazo(prazo);
        if (prazo != null && processo == null) {
            processo = prazo.getProcesso();
            e.setProcesso(processo);
        }
        validarCoerencia(e, processo, prazo);
        e.setDataLimite(r.getDataLimite());
        if (r.getObservacaoConclusao() != null) {
            e.setObservacaoConclusao(r.getObservacaoConclusao());
        }
        if (e.getStatus() == TarefaOperacionalStatus.CONCLUIDA && e.getDataConclusao() == null && criacao) {
            e.setDataConclusao(LocalDateTime.now());
        }
    }

    private void validarCoerencia(TarefaOperacional e, Processo processo, ProcessoPrazo prazo) {
        if (e.getCliente() != null && processo != null) {
            if (!processo.getCliente().getId().equals(e.getCliente().getId())) {
                throw new RegraNegocioException("Cliente informado não corresponde ao cliente do processo.");
            }
        }
        if (prazo != null && processo != null && !prazo.getProcesso().getId().equals(processo.getId())) {
            throw new RegraNegocioException("Prazo não pertence ao processo informado.");
        }
        if (e.getPublicacao() != null && e.getPublicacao().getProcesso() != null && processo != null) {
            if (!e.getPublicacao().getProcesso().getId().equals(processo.getId())) {
                throw new RegraNegocioException("Publicação vinculada a outro processo.");
            }
        }
    }

    private Usuario resolveUsuario(Long id) {
        if (id == null) return null;
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new RegraNegocioException("Usuário não encontrado: " + id));
    }

    private Cliente resolveCliente(Long id) {
        if (id == null) return null;
        return clienteRepository.findById(id)
                .orElseThrow(() -> new RegraNegocioException("Cliente não encontrado: " + id));
    }

    private Processo resolveProcesso(Long id) {
        if (id == null) return null;
        return processoRepository.findById(id)
                .orElseThrow(() -> new RegraNegocioException("Processo não encontrado: " + id));
    }

    private Publicacao resolvePublicacao(Long id) {
        if (id == null) return null;
        return publicacaoRepository.findById(id)
                .orElseThrow(() -> new RegraNegocioException("Publicação não encontrada: " + id));
    }

    private AgendaEvento resolveAgenda(Long id) {
        if (id == null) return null;
        return agendaEventoRepository.findById(id)
                .orElseThrow(() -> new RegraNegocioException("Evento de agenda não encontrado: " + id));
    }

    private ProcessoPrazo resolvePrazo(Long id) {
        if (id == null) return null;
        return processoPrazoRepository.findById(id)
                .orElseThrow(() -> new RegraNegocioException("Prazo processual não encontrado: " + id));
    }

    private TarefaOperacionalResponse toResponse(TarefaOperacional e) {
        TarefaOperacionalResponse o = new TarefaOperacionalResponse();
        o.setId(e.getId());
        o.setTitulo(e.getTitulo());
        o.setDescricao(e.getDescricao());
        o.setStatus(e.getStatus());
        o.setPrioridade(e.getPrioridade());
        o.setOrigem(e.getOrigem());
        o.setResponsavelUsuarioId(e.getResponsavel() != null ? e.getResponsavel().getId() : null);
        o.setCriadorUsuarioId(e.getCriador() != null ? e.getCriador().getId() : null);
        o.setClienteId(e.getCliente() != null ? e.getCliente().getId() : null);
        o.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        o.setPublicacaoId(e.getPublicacao() != null ? e.getPublicacao().getId() : null);
        o.setAgendaEventoId(e.getAgendaEvento() != null ? e.getAgendaEvento().getId() : null);
        o.setProcessoPrazoId(e.getProcessoPrazo() != null ? e.getProcessoPrazo().getId() : null);
        o.setDataLimite(e.getDataLimite());
        o.setDataConclusao(e.getDataConclusao());
        o.setObservacaoConclusao(e.getObservacaoConclusao());
        o.setCreatedAt(e.getCreatedAt());
        o.setUpdatedAt(e.getUpdatedAt());
        return o;
    }
}
