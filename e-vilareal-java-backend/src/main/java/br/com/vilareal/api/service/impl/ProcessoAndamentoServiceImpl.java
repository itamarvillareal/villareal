package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.ProcessoAndamentoRequest;
import br.com.vilareal.api.dto.ProcessoAndamentoResponse;
import br.com.vilareal.api.entity.Processo;
import br.com.vilareal.api.entity.ProcessoAndamento;
import br.com.vilareal.api.entity.Usuario;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.ProcessoAndamentoRepository;
import br.com.vilareal.api.repository.ProcessoRepository;
import br.com.vilareal.api.repository.UsuarioRepository;
import br.com.vilareal.api.service.ProcessoAndamentoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProcessoAndamentoServiceImpl implements ProcessoAndamentoService {
    private final ProcessoRepository processoRepository;
    private final ProcessoAndamentoRepository andamentoRepository;
    private final UsuarioRepository usuarioRepository;

    public ProcessoAndamentoServiceImpl(ProcessoRepository processoRepository,
                                        ProcessoAndamentoRepository andamentoRepository,
                                        UsuarioRepository usuarioRepository) {
        this.processoRepository = processoRepository;
        this.andamentoRepository = andamentoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProcessoAndamentoResponse> listar(Long processoId) {
        garantirProcesso(processoId);
        return andamentoRepository.findByProcesso_IdOrderByMovimentoEmDesc(processoId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ProcessoAndamentoResponse criar(Long processoId, ProcessoAndamentoRequest request) {
        Processo proc = garantirProcesso(processoId);
        ProcessoAndamento a = new ProcessoAndamento();
        a.setProcesso(proc);
        apply(a, request);
        return toResponse(andamentoRepository.save(a));
    }

    @Override
    @Transactional
    public ProcessoAndamentoResponse atualizar(Long processoId, Long andamentoId, ProcessoAndamentoRequest request) {
        garantirProcesso(processoId);
        ProcessoAndamento a = andamentoRepository.findById(andamentoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Andamento não encontrado: " + andamentoId));
        if (!a.getProcesso().getId().equals(processoId)) {
            throw new RegraNegocioException("Andamento não pertence a este processo.");
        }
        apply(a, request);
        return toResponse(andamentoRepository.save(a));
    }

    @Override
    @Transactional
    public void remover(Long processoId, Long andamentoId) {
        garantirProcesso(processoId);
        ProcessoAndamento a = andamentoRepository.findById(andamentoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Andamento não encontrado: " + andamentoId));
        if (!a.getProcesso().getId().equals(processoId)) {
            throw new RegraNegocioException("Andamento não pertence a este processo.");
        }
        andamentoRepository.delete(a);
    }

    private Processo garantirProcesso(Long id) {
        return processoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Processo não encontrado: " + id));
    }

    private void apply(ProcessoAndamento a, ProcessoAndamentoRequest r) {
        a.setMovimentoEm(r.getMovimentoEm());
        a.setTitulo(r.getTitulo().trim());
        a.setDetalhe(trimOrNull(r.getDetalhe()));
        String origem = r.getOrigem() != null && !r.getOrigem().isBlank() ? r.getOrigem().trim() : "MANUAL";
        a.setOrigem(origem);
        a.setOrigemAutomatica(r.getOrigemAutomatica() != null ? r.getOrigemAutomatica() : false);
        if (r.getUsuarioId() != null) {
            Usuario u = usuarioRepository.findById(r.getUsuarioId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + r.getUsuarioId()));
            a.setUsuario(u);
        } else {
            a.setUsuario(null);
        }
    }

    private ProcessoAndamentoResponse toResponse(ProcessoAndamento a) {
        ProcessoAndamentoResponse o = new ProcessoAndamentoResponse();
        o.setId(a.getId());
        o.setProcessoId(a.getProcesso().getId());
        o.setMovimentoEm(a.getMovimentoEm());
        o.setTitulo(a.getTitulo());
        o.setDetalhe(a.getDetalhe());
        o.setOrigem(a.getOrigem());
        o.setOrigemAutomatica(a.getOrigemAutomatica());
        o.setUsuarioId(a.getUsuario() != null ? a.getUsuario().getId() : null);
        o.setCreatedAt(a.getCreatedAt());
        o.setUpdatedAt(a.getUpdatedAt());
        return o;
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
