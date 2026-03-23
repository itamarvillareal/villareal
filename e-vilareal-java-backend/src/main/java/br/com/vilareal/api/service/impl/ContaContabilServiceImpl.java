package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.ContaContabilRequest;
import br.com.vilareal.api.dto.ContaContabilResponse;
import br.com.vilareal.api.entity.ContaContabil;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.ContaContabilRepository;
import br.com.vilareal.api.service.ContaContabilService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ContaContabilServiceImpl implements ContaContabilService {
    private final ContaContabilRepository contaContabilRepository;

    public ContaContabilServiceImpl(ContaContabilRepository contaContabilRepository) {
        this.contaContabilRepository = contaContabilRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ContaContabilResponse> listar() {
        return contaContabilRepository.findAllByOrderByOrdemExibicaoAscNomeAsc()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ContaContabilResponse criar(ContaContabilRequest request) {
        validarDuplicidade(null, request);
        ContaContabil c = new ContaContabil();
        apply(c, request);
        return toResponse(contaContabilRepository.save(c));
    }

    @Override
    @Transactional
    public ContaContabilResponse atualizar(Long id, ContaContabilRequest request) {
        ContaContabil c = contaContabilRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Conta contábil não encontrada: " + id));
        validarDuplicidade(id, request);
        apply(c, request);
        return toResponse(contaContabilRepository.save(c));
    }

    private void validarDuplicidade(Long id, ContaContabilRequest request) {
        String codigo = trimUpper(request.getCodigo());
        String nome = trimOrNull(request.getNome());
        if (id == null) {
            if (contaContabilRepository.findByCodigo(codigo).isPresent()) {
                throw new RegraNegocioException("Código de conta contábil já cadastrado.");
            }
            if (contaContabilRepository.findByNome(nome).isPresent()) {
                throw new RegraNegocioException("Nome de conta contábil já cadastrado.");
            }
            return;
        }
        if (contaContabilRepository.existsByCodigoAndIdNot(codigo, id)) {
            throw new RegraNegocioException("Código de conta contábil já cadastrado.");
        }
        if (contaContabilRepository.existsByNomeAndIdNot(nome, id)) {
            throw new RegraNegocioException("Nome de conta contábil já cadastrado.");
        }
    }

    private void apply(ContaContabil c, ContaContabilRequest r) {
        c.setCodigo(trimUpper(r.getCodigo()));
        c.setNome(trimOrNull(r.getNome()));
        c.setTipo(trimUpper(r.getTipo()));
        c.setNaturezaPadrao(trimUpper(r.getNaturezaPadrao()));
        c.setGrupoContabil(trimOrNull(r.getGrupoContabil()));
        c.setAceitaVinculoProcesso(Boolean.TRUE.equals(r.getAceitaVinculoProcesso()));
        c.setAceitaCompensacao(Boolean.TRUE.equals(r.getAceitaCompensacao()));
        c.setAtiva(!Boolean.FALSE.equals(r.getAtiva()));
        c.setOrdemExibicao(r.getOrdemExibicao() != null ? r.getOrdemExibicao() : 0);
    }

    private ContaContabilResponse toResponse(ContaContabil c) {
        ContaContabilResponse o = new ContaContabilResponse();
        o.setId(c.getId());
        o.setCodigo(c.getCodigo());
        o.setNome(c.getNome());
        o.setTipo(c.getTipo());
        o.setNaturezaPadrao(c.getNaturezaPadrao());
        o.setGrupoContabil(c.getGrupoContabil());
        o.setAceitaVinculoProcesso(c.getAceitaVinculoProcesso());
        o.setAceitaCompensacao(c.getAceitaCompensacao());
        o.setAtiva(c.getAtiva());
        o.setOrdemExibicao(c.getOrdemExibicao());
        o.setCreatedAt(c.getCreatedAt());
        o.setUpdatedAt(c.getUpdatedAt());
        return o;
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String trimUpper(String s) {
        String t = trimOrNull(s);
        return t == null ? null : t.toUpperCase();
    }
}
