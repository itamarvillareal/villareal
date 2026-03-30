package br.com.vilareal.tarefa.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.tarefa.api.dto.TarefaOperacionalResponse;
import br.com.vilareal.tarefa.api.dto.TarefaOperacionalWriteRequest;
import br.com.vilareal.tarefa.api.dto.TarefaStatusPatchRequest;
import br.com.vilareal.tarefa.infrastructure.persistence.TarefaOperacionalSpecifications;
import br.com.vilareal.tarefa.infrastructure.persistence.entity.TarefaOperacionalEntity;
import br.com.vilareal.tarefa.infrastructure.persistence.repository.TarefaOperacionalRepository;
import br.com.vilareal.tarefa.model.TarefaPrioridade;
import br.com.vilareal.tarefa.model.TarefaStatus;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TarefaOperacionalApplicationService {

    private static final Sort ORDEM_RECENTES = Sort.by(Sort.Direction.DESC, "createdAt", "id");

    private final TarefaOperacionalRepository tarefaRepository;
    private final UsuarioRepository usuarioRepository;

    public TarefaOperacionalApplicationService(
            TarefaOperacionalRepository tarefaRepository,
            UsuarioRepository usuarioRepository) {
        this.tarefaRepository = tarefaRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public List<TarefaOperacionalResponse> listar(
            Long responsavelId,
            TarefaStatus status,
            TarefaPrioridade prioridade,
            Long clienteId,
            Long processoId,
            LocalDate dataLimiteDe,
            LocalDate dataLimiteAte) {
        var spec = TarefaOperacionalSpecifications.comFiltros(
                responsavelId, status, prioridade, clienteId, processoId, dataLimiteDe, dataLimiteAte);
        return tarefaRepository.findAll(spec, ORDEM_RECENTES).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TarefaOperacionalResponse buscar(Long id) {
        TarefaOperacionalEntity e = tarefaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tarefa não encontrada: " + id));
        return toResponse(e);
    }

    @Transactional
    public TarefaOperacionalResponse criar(TarefaOperacionalWriteRequest req) {
        TarefaOperacionalEntity e = new TarefaOperacionalEntity();
        aplicarCampos(e, req, true);
        e = tarefaRepository.save(e);
        return toResponse(e);
    }

    @Transactional
    public TarefaOperacionalResponse atualizar(Long id, TarefaOperacionalWriteRequest req) {
        TarefaOperacionalEntity e = tarefaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tarefa não encontrada: " + id));
        aplicarCampos(e, req, false);
        e = tarefaRepository.save(e);
        return toResponse(e);
    }

    @Transactional
    public TarefaOperacionalResponse patchStatus(Long id, TarefaStatusPatchRequest req) {
        TarefaOperacionalEntity e = tarefaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tarefa não encontrada: " + id));
        TarefaStatus novo = req.getStatus();
        e.setStatus(novo);
        if (novo == TarefaStatus.CONCLUIDA) {
            if (e.getDataConclusao() == null) {
                e.setDataConclusao(Instant.now());
            }
        } else {
            e.setDataConclusao(null);
        }
        e = tarefaRepository.save(e);
        return toResponse(e);
    }

    private void aplicarCampos(TarefaOperacionalEntity e, TarefaOperacionalWriteRequest req, boolean criacao) {
        String titulo = req.getTitulo() != null ? req.getTitulo().trim() : "";
        if (!StringUtils.hasText(titulo)) {
            throw new BusinessRuleException("titulo é obrigatório.");
        }
        if (titulo.length() > 500) {
            throw new BusinessRuleException("titulo excede 500 caracteres.");
        }
        e.setTitulo(titulo);

        if (req.getDescricao() != null) {
            String d = req.getDescricao().trim();
            e.setDescricao(d.isEmpty() ? null : d);
        } else if (criacao) {
            e.setDescricao(null);
        }

        if (req.getResponsavelUsuarioId() != null) {
            UsuarioEntity u = usuarioRepository.findById(req.getResponsavelUsuarioId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Usuário não encontrado: " + req.getResponsavelUsuarioId()));
            e.setResponsavel(u);
        } else {
            e.setResponsavel(null);
        }

        if (criacao) {
            e.setStatus(req.getStatus() != null ? req.getStatus() : TarefaStatus.PENDENTE);
            e.setPrioridade(req.getPrioridade() != null ? req.getPrioridade() : TarefaPrioridade.NORMAL);
            e.setDataLimite(req.getDataLimite());
            e.setClienteId(req.getClienteId());
            e.setProcessoId(req.getProcessoId());
            e.setPublicacaoId(req.getPublicacaoId());
            e.setProcessoPrazoId(req.getProcessoPrazoId());
        } else {
            if (req.getDataLimite() != null) {
                e.setDataLimite(req.getDataLimite());
            }
            if (req.getClienteId() != null) {
                e.setClienteId(req.getClienteId());
            }
            if (req.getProcessoId() != null) {
                e.setProcessoId(req.getProcessoId());
            }
            if (req.getPublicacaoId() != null) {
                e.setPublicacaoId(req.getPublicacaoId());
            }
            if (req.getProcessoPrazoId() != null) {
                e.setProcessoPrazoId(req.getProcessoPrazoId());
            }
        }

        if (StringUtils.hasText(req.getOrigem())) {
            String o = req.getOrigem().trim();
            if (o.length() > 80) {
                throw new BusinessRuleException("origem excede 80 caracteres.");
            }
            e.setOrigem(o);
        } else if (criacao) {
            e.setOrigem("BOARD");
        }

        if (!criacao) {
            if (req.getStatus() != null) {
                e.setStatus(req.getStatus());
            }
            if (req.getPrioridade() != null) {
                e.setPrioridade(req.getPrioridade());
            }
        }

        sincronizarDataConclusaoComStatus(e);
    }

    private static void sincronizarDataConclusaoComStatus(TarefaOperacionalEntity e) {
        if (e.getStatus() == TarefaStatus.CONCLUIDA) {
            if (e.getDataConclusao() == null) {
                e.setDataConclusao(Instant.now());
            }
        } else {
            e.setDataConclusao(null);
        }
    }

    private TarefaOperacionalResponse toResponse(TarefaOperacionalEntity e) {
        TarefaOperacionalResponse r = new TarefaOperacionalResponse();
        r.setId(e.getId());
        r.setTitulo(Utf8MojibakeUtil.corrigir(e.getTitulo()));
        r.setDescricao(Utf8MojibakeUtil.corrigir(e.getDescricao()));
        if (e.getResponsavel() != null) {
            r.setResponsavelUsuarioId(e.getResponsavel().getId());
        }
        r.setStatus(e.getStatus());
        r.setPrioridade(e.getPrioridade());
        r.setDataLimite(e.getDataLimite());
        r.setClienteId(e.getClienteId());
        r.setProcessoId(e.getProcessoId());
        r.setPublicacaoId(e.getPublicacaoId());
        r.setProcessoPrazoId(e.getProcessoPrazoId());
        r.setOrigem(Utf8MojibakeUtil.corrigir(e.getOrigem()));
        r.setCreatedAt(e.getCreatedAt());
        r.setDataConclusao(e.getDataConclusao());
        return r;
    }
}
