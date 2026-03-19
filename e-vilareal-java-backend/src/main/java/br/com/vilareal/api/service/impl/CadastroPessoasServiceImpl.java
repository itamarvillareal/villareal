package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.CadastroPessoasRequest;
import br.com.vilareal.api.dto.CadastroPessoasResponse;
import br.com.vilareal.api.entity.CadastroPessoa;
import br.com.vilareal.api.exception.CadastroPessoaNaoEncontradaException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.CadastroPessoasRepository;
import br.com.vilareal.api.service.CadastroPessoasService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CadastroPessoasServiceImpl implements CadastroPessoasService {

    private final CadastroPessoasRepository repository;

    public CadastroPessoasServiceImpl(CadastroPessoasRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public CadastroPessoasResponse criar(CadastroPessoasRequest request) {
        validarEmailUnico(request.getEmail(), null);
        validarCpfUnico(request.getCpf(), null);
        CadastroPessoa entity = toEntity(request);
        entity = repository.save(entity);
        return toResponse(entity);
    }

    @Override
    @Transactional
    public CadastroPessoasResponse atualizar(Long id, CadastroPessoasRequest request) {
        CadastroPessoa entity = buscarEntidadePorId(id);
        validarEmailUnico(request.getEmail(), id);
        validarCpfUnico(request.getCpf(), id);
        atualizarEntidade(entity, request);
        entity = repository.save(entity);
        return toResponse(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CadastroPessoasResponse> buscarPorId(Long id) {
        return repository.findById(id).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CadastroPessoasResponse> listarTodos() {
        return repository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CadastroPessoasResponse> listarAtivos() {
        return repository.findByAtivoTrue().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void excluir(Long id) {
        CadastroPessoa entity = buscarEntidadePorId(id);
        repository.delete(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existePorId(Long id) {
        return repository.existsById(id);
    }

    private CadastroPessoa buscarEntidadePorId(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new CadastroPessoaNaoEncontradaException(id));
    }

    private void validarEmailUnico(String email, Long idExcluir) {
        boolean emUso = idExcluir == null
                ? repository.existsByEmail(email)
                : repository.existsByEmailAndIdNot(email, idExcluir);
        if (emUso) throw new RegraNegocioException("Já existe cadastro com o e-mail informado.");
    }

    private void validarCpfUnico(String cpf, Long idExcluir) {
        boolean emUso = idExcluir == null
                ? repository.existsByCpf(cpf)
                : repository.existsByCpfAndIdNot(cpf, idExcluir);
        if (emUso) throw new RegraNegocioException("Já existe cadastro com o CPF informado.");
    }

    private static String normalizarCpf(String cpf) {
        return cpf == null ? null : cpf.replaceAll("\\D", "");
    }

    private CadastroPessoa toEntity(CadastroPessoasRequest request) {
        CadastroPessoa e = new CadastroPessoa();
        e.setNome(request.getNome());
        e.setEmail(request.getEmail());
        e.setCpf(normalizarCpf(request.getCpf()));
        e.setTelefone(request.getTelefone());
        e.setDataNascimento(request.getDataNascimento());
        e.setAtivo(request.getAtivo() != null ? request.getAtivo() : true);
        return e;
    }

    private void atualizarEntidade(CadastroPessoa entity, CadastroPessoasRequest request) {
        entity.setNome(request.getNome());
        entity.setEmail(request.getEmail());
        entity.setCpf(normalizarCpf(request.getCpf()));
        entity.setTelefone(request.getTelefone());
        entity.setDataNascimento(request.getDataNascimento());
        if (request.getAtivo() != null) entity.setAtivo(request.getAtivo());
    }

    private CadastroPessoasResponse toResponse(CadastroPessoa e) {
        CadastroPessoasResponse r = new CadastroPessoasResponse();
        r.setId(e.getId());
        r.setNome(e.getNome());
        r.setEmail(e.getEmail());
        r.setCpf(e.getCpf());
        r.setTelefone(e.getTelefone());
        r.setDataNascimento(e.getDataNascimento());
        r.setAtivo(e.getAtivo());
        r.setDataCriacao(e.getDataCriacao());
        r.setDataAtualizacao(e.getDataAtualizacao());
        return r;
    }
}
