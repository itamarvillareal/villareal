package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.ProcessoParteRequest;
import br.com.vilareal.api.dto.ProcessoParteResponse;
import br.com.vilareal.api.entity.CadastroPessoa;
import br.com.vilareal.api.entity.Processo;
import br.com.vilareal.api.entity.ProcessoParte;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.CadastroPessoasRepository;
import br.com.vilareal.api.repository.ProcessoParteRepository;
import br.com.vilareal.api.repository.ProcessoRepository;
import br.com.vilareal.api.service.ProcessoParteService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProcessoParteServiceImpl implements ProcessoParteService {
    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository parteRepository;
    private final CadastroPessoasRepository cadastroPessoasRepository;

    public ProcessoParteServiceImpl(ProcessoRepository processoRepository,
                                    ProcessoParteRepository parteRepository,
                                    CadastroPessoasRepository cadastroPessoasRepository) {
        this.processoRepository = processoRepository;
        this.parteRepository = parteRepository;
        this.cadastroPessoasRepository = cadastroPessoasRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProcessoParteResponse> listar(Long processoId) {
        garantirProcesso(processoId);
        return parteRepository.findByProcesso_IdOrderByPoloAscOrdemAsc(processoId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ProcessoParteResponse criar(Long processoId, ProcessoParteRequest request) {
        Processo proc = garantirProcesso(processoId);
        validarPessoaOuNome(request);
        ProcessoParte pp = new ProcessoParte();
        pp.setProcesso(proc);
        apply(pp, request);
        return toResponse(parteRepository.save(pp));
    }

    @Override
    @Transactional
    public ProcessoParteResponse atualizar(Long processoId, Long parteId, ProcessoParteRequest request) {
        garantirProcesso(processoId);
        ProcessoParte pp = parteRepository.findById(parteId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Parte não encontrada: " + parteId));
        if (!pp.getProcesso().getId().equals(processoId)) {
            throw new RegraNegocioException("Parte não pertence a este processo.");
        }
        validarPessoaOuNome(request);
        apply(pp, request);
        return toResponse(parteRepository.save(pp));
    }

    @Override
    @Transactional
    public void remover(Long processoId, Long parteId) {
        garantirProcesso(processoId);
        ProcessoParte pp = parteRepository.findById(parteId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Parte não encontrada: " + parteId));
        if (!pp.getProcesso().getId().equals(processoId)) {
            throw new RegraNegocioException("Parte não pertence a este processo.");
        }
        parteRepository.delete(pp);
    }

    private Processo garantirProcesso(Long id) {
        return processoRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Processo não encontrado: " + id));
    }

    private void validarPessoaOuNome(ProcessoParteRequest r) {
        boolean temPessoa = r.getPessoaId() != null;
        boolean temNome = r.getNomeLivre() != null && !r.getNomeLivre().isBlank();
        if (temPessoa == temNome) {
            throw new RegraNegocioException("Informe pessoaId OU nomeLivre (exclusivo).");
        }
    }

    private void apply(ProcessoParte pp, ProcessoParteRequest r) {
        pp.setPolo(r.getPolo().trim().toUpperCase());
        pp.setQualificacao(trimOrNull(r.getQualificacao()));
        pp.setOrdem(r.getOrdem() != null ? r.getOrdem() : 0);
        if (r.getPessoaId() != null) {
            CadastroPessoa p = cadastroPessoasRepository.findById(r.getPessoaId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Pessoa não encontrada: " + r.getPessoaId()));
            pp.setPessoa(p);
            pp.setNomeLivre(null);
        } else {
            pp.setPessoa(null);
            pp.setNomeLivre(r.getNomeLivre().trim());
        }
    }

    private ProcessoParteResponse toResponse(ProcessoParte pp) {
        ProcessoParteResponse o = new ProcessoParteResponse();
        o.setId(pp.getId());
        o.setProcessoId(pp.getProcesso().getId());
        o.setPessoaId(pp.getPessoa() != null ? pp.getPessoa().getId() : null);
        o.setNomeLivre(pp.getNomeLivre());
        if (pp.getPessoa() != null) {
            o.setNomeExibicao(pp.getPessoa().getNome());
        } else {
            o.setNomeExibicao(pp.getNomeLivre());
        }
        o.setPolo(pp.getPolo());
        o.setQualificacao(pp.getQualificacao());
        o.setOrdem(pp.getOrdem());
        o.setCreatedAt(pp.getCreatedAt());
        o.setUpdatedAt(pp.getUpdatedAt());
        return o;
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
