package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.ProcessoPrazoRequest;
import br.com.vilareal.api.dto.ProcessoPrazoResponse;
import br.com.vilareal.api.entity.Processo;
import br.com.vilareal.api.entity.ProcessoAndamento;
import br.com.vilareal.api.entity.ProcessoPrazo;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.ProcessoAndamentoRepository;
import br.com.vilareal.api.repository.ProcessoPrazoRepository;
import br.com.vilareal.api.repository.ProcessoRepository;
import br.com.vilareal.api.service.ProcessoPrazoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProcessoPrazoServiceImpl implements ProcessoPrazoService {
    private final ProcessoRepository processoRepository;
    private final ProcessoPrazoRepository prazoRepository;
    private final ProcessoAndamentoRepository andamentoRepository;

    public ProcessoPrazoServiceImpl(ProcessoRepository processoRepository,
                                    ProcessoPrazoRepository prazoRepository,
                                    ProcessoAndamentoRepository andamentoRepository) {
        this.processoRepository = processoRepository;
        this.prazoRepository = prazoRepository;
        this.andamentoRepository = andamentoRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProcessoPrazoResponse> listar(Long processoId) {
        garantirProcesso(processoId);
        return prazoRepository.findByProcesso_IdOrderByDataFimAsc(processoId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ProcessoPrazoResponse criar(Long processoId, ProcessoPrazoRequest request) {
        Processo proc = garantirProcesso(processoId);
        ProcessoPrazo z = new ProcessoPrazo();
        z.setProcesso(proc);
        apply(z, request, proc.getId());
        return toResponse(prazoRepository.save(z));
    }

    @Override
    @Transactional
    public ProcessoPrazoResponse atualizar(Long processoId, Long prazoId, ProcessoPrazoRequest request) {
        Processo proc = garantirProcesso(processoId);
        ProcessoPrazo z = prazoRepository.findByIdAndProcesso_Id(prazoId, processoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Prazo não encontrado: " + prazoId));
        apply(z, request, proc.getId());
        return toResponse(prazoRepository.save(z));
    }

    @Override
    @Transactional
    public ProcessoPrazoResponse alterarCumprimento(Long processoId, Long prazoId, boolean cumprido) {
        garantirProcesso(processoId);
        ProcessoPrazo z = prazoRepository.findByIdAndProcesso_Id(prazoId, processoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Prazo não encontrado: " + prazoId));
        if (cumprido) {
            z.setStatus("CUMPRIDO");
            z.setCumpridoEm(LocalDateTime.now());
        } else {
            z.setStatus("PENDENTE");
            z.setCumpridoEm(null);
        }
        return toResponse(prazoRepository.save(z));
    }

    @Override
    @Transactional
    public void remover(Long processoId, Long prazoId) {
        garantirProcesso(processoId);
        ProcessoPrazo z = prazoRepository.findByIdAndProcesso_Id(prazoId, processoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Prazo não encontrado: " + prazoId));
        prazoRepository.delete(z);
    }

    private Processo garantirProcesso(Long id) {
        return processoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Processo não encontrado: " + id));
    }

    private void apply(ProcessoPrazo z, ProcessoPrazoRequest r, Long processoId) {
        z.setDescricao(r.getDescricao().trim());
        z.setDataInicio(r.getDataInicio());
        z.setDataFim(r.getDataFim());
        z.setPrazoFatal(r.getPrazoFatal() != null ? r.getPrazoFatal() : false);
        String st = r.getStatus() != null && !r.getStatus().isBlank() ? r.getStatus().trim().toUpperCase() : "PENDENTE";
        z.setStatus(st);
        z.setCumpridoEm(r.getCumpridoEm());
        z.setObservacao(trimOrNull(r.getObservacao()));
        if (r.getAndamentoId() != null) {
            ProcessoAndamento a = andamentoRepository.findById(r.getAndamentoId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Andamento não encontrado: " + r.getAndamentoId()));
            if (!a.getProcesso().getId().equals(processoId)) {
                throw new RegraNegocioException("Andamento não pertence a este processo.");
            }
            z.setAndamento(a);
        } else {
            z.setAndamento(null);
        }
    }

    private ProcessoPrazoResponse toResponse(ProcessoPrazo z) {
        ProcessoPrazoResponse o = new ProcessoPrazoResponse();
        o.setId(z.getId());
        o.setProcessoId(z.getProcesso().getId());
        o.setAndamentoId(z.getAndamento() != null ? z.getAndamento().getId() : null);
        o.setDescricao(z.getDescricao());
        o.setDataInicio(z.getDataInicio());
        o.setDataFim(z.getDataFim());
        o.setPrazoFatal(z.getPrazoFatal());
        o.setStatus(z.getStatus());
        o.setCumpridoEm(z.getCumpridoEm());
        o.setObservacao(z.getObservacao());
        o.setCreatedAt(z.getCreatedAt());
        o.setUpdatedAt(z.getUpdatedAt());
        return o;
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
