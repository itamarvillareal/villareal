package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.PermissaoRequest;
import br.com.vilareal.api.dto.PermissaoResponse;
import br.com.vilareal.api.entity.Permissao;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.PermissaoRepository;
import br.com.vilareal.api.service.PermissaoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class PermissaoServiceImpl implements PermissaoService {
    private final PermissaoRepository permissaoRepository;

    public PermissaoServiceImpl(PermissaoRepository permissaoRepository) {
        this.permissaoRepository = permissaoRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PermissaoResponse> listar() {
        return permissaoRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public PermissaoResponse criar(PermissaoRequest request) {
        String codigo = normalize(request.getCodigo());
        if (permissaoRepository.existsByCodigo(codigo)) {
            throw new RegraNegocioException("Já existe permissão com este código.");
        }
        Permissao e = new Permissao();
        e.setCodigo(codigo);
        e.setModulo(trim(request.getModulo()));
        e.setDescricao(trimOrNull(request.getDescricao()));
        return toResponse(permissaoRepository.save(e));
    }

    private PermissaoResponse toResponse(Permissao e) {
        PermissaoResponse r = new PermissaoResponse();
        r.setId(e.getId());
        r.setCodigo(e.getCodigo());
        r.setModulo(e.getModulo());
        r.setDescricao(e.getDescricao());
        r.setCreatedAt(e.getCreatedAt());
        r.setUpdatedAt(e.getUpdatedAt());
        return r;
    }

    private static String normalize(String s) { return trim(s).toUpperCase(); }
    private static String trim(String s) { return String.valueOf(s == null ? "" : s).trim(); }
    private static String trimOrNull(String s) {
        String t = trim(s);
        return t.isBlank() ? null : t;
    }
}
