package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.PessoaDadosComplementaresRequest;
import br.com.vilareal.api.dto.PessoaDadosComplementaresResponse;
import br.com.vilareal.api.entity.CadastroPessoa;
import br.com.vilareal.api.entity.PessoaDadosComplementares;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.repository.CadastroPessoasRepository;
import br.com.vilareal.api.repository.PessoaDadosComplementaresRepository;
import br.com.vilareal.api.service.PessoaDadosComplementaresService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PessoaDadosComplementaresServiceImpl implements PessoaDadosComplementaresService {
    private final PessoaDadosComplementaresRepository repository;
    private final CadastroPessoasRepository cadastroPessoasRepository;

    public PessoaDadosComplementaresServiceImpl(
            PessoaDadosComplementaresRepository repository,
            CadastroPessoasRepository cadastroPessoasRepository) {
        this.repository = repository;
        this.cadastroPessoasRepository = cadastroPessoasRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public PessoaDadosComplementaresResponse obter(Long pessoaId) {
        return repository.findById(pessoaId).map(this::toResponse).orElse(null);
    }

    @Override
    @Transactional
    public PessoaDadosComplementaresResponse salvar(Long pessoaId, PessoaDadosComplementaresRequest request) {
        CadastroPessoa pessoa = cadastroPessoasRepository.findById(pessoaId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Pessoa não encontrada: " + pessoaId));
        PessoaDadosComplementares e = repository.findById(pessoaId).orElseGet(PessoaDadosComplementares::new);
        e.setPessoa(pessoa);
        e.setRg(trimOrNull(request.getRg()));
        e.setOrgaoExpedidor(trimOrNull(request.getOrgaoExpedidor()));
        e.setProfissao(trimOrNull(request.getProfissao()));
        e.setNacionalidade(trimOrNull(request.getNacionalidade()));
        e.setEstadoCivil(trimOrNull(request.getEstadoCivil()));
        e.setGenero(trimOrNull(request.getGenero()));
        return toResponse(repository.save(e));
    }

    private PessoaDadosComplementaresResponse toResponse(PessoaDadosComplementares e) {
        PessoaDadosComplementaresResponse r = new PessoaDadosComplementaresResponse();
        r.setPessoaId(e.getPessoaId());
        r.setRg(e.getRg());
        r.setOrgaoExpedidor(e.getOrgaoExpedidor());
        r.setProfissao(e.getProfissao());
        r.setNacionalidade(e.getNacionalidade());
        r.setEstadoCivil(e.getEstadoCivil());
        r.setGenero(e.getGenero());
        return r;
    }

    private static String trimOrNull(String s) {
        String t = String.valueOf(s == null ? "" : s).trim();
        return t.isBlank() ? null : t;
    }
}
