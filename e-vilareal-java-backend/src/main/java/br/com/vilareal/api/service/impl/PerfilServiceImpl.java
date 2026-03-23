package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.PerfilRequest;
import br.com.vilareal.api.dto.PerfilResponse;
import br.com.vilareal.api.entity.*;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.*;
import br.com.vilareal.api.service.PerfilService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PerfilServiceImpl implements PerfilService {
    private final PerfilRepository perfilRepository;
    private final PermissaoRepository permissaoRepository;
    private final PerfilPermissaoRepository perfilPermissaoRepository;

    public PerfilServiceImpl(
            PerfilRepository perfilRepository,
            PermissaoRepository permissaoRepository,
            PerfilPermissaoRepository perfilPermissaoRepository) {
        this.perfilRepository = perfilRepository;
        this.permissaoRepository = permissaoRepository;
        this.perfilPermissaoRepository = perfilPermissaoRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PerfilResponse> listar() {
        return perfilRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public PerfilResponse criar(PerfilRequest request) {
        String codigo = normalize(request.getCodigo());
        if (perfilRepository.existsByCodigo(codigo)) {
            throw new RegraNegocioException("Já existe perfil com este código.");
        }
        Perfil p = new Perfil();
        p.setCodigo(codigo);
        p.setNome(trim(request.getNome()));
        p.setDescricao(trimOrNull(request.getDescricao()));
        p.setAtivo(request.getAtivo() == null ? Boolean.TRUE : request.getAtivo());
        return toResponse(perfilRepository.save(p));
    }

    @Override
    @Transactional
    public PerfilResponse atualizar(Long id, PerfilRequest request) {
        Perfil p = perfilRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Perfil não encontrado: " + id));
        String codigo = normalize(request.getCodigo());
        if (perfilRepository.existsByCodigoAndIdNot(codigo, id)) {
            throw new RegraNegocioException("Já existe perfil com este código.");
        }
        p.setCodigo(codigo);
        p.setNome(trim(request.getNome()));
        p.setDescricao(trimOrNull(request.getDescricao()));
        if (request.getAtivo() != null) p.setAtivo(request.getAtivo());
        return toResponse(perfilRepository.save(p));
    }

    @Override
    @Transactional
    public PerfilResponse definirPermissoes(Long id, List<Long> permissaoIds) {
        Perfil perfil = perfilRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Perfil não encontrado: " + id));
        perfilPermissaoRepository.deleteByPerfil_Id(id);
        List<Long> ids = permissaoIds == null ? List.of() : permissaoIds.stream().distinct().toList();
        for (Long permissaoId : ids) {
            Permissao permissao = permissaoRepository.findById(permissaoId)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Permissão não encontrada: " + permissaoId));
            PerfilPermissao rel = new PerfilPermissao();
            rel.setId(new PerfilPermissaoId(perfil.getId(), permissao.getId()));
            rel.setPerfil(perfil);
            rel.setPermissao(permissao);
            perfilPermissaoRepository.save(rel);
        }
        return toResponse(perfil);
    }

    private PerfilResponse toResponse(Perfil p) {
        PerfilResponse r = new PerfilResponse();
        r.setId(p.getId());
        r.setCodigo(p.getCodigo());
        r.setNome(p.getNome());
        r.setDescricao(p.getDescricao());
        r.setAtivo(p.getAtivo());
        r.setCreatedAt(p.getCreatedAt());
        r.setUpdatedAt(p.getUpdatedAt());
        List<Long> permissaoIds = new ArrayList<>();
        for (PerfilPermissao rel : perfilPermissaoRepository.findByPerfil_Id(p.getId())) {
            permissaoIds.add(rel.getPermissao().getId());
        }
        r.setPermissaoIds(permissaoIds);
        return r;
    }

    private static String normalize(String s) { return trim(s).toUpperCase(); }
    private static String trim(String s) { return String.valueOf(s == null ? "" : s).trim(); }
    private static String trimOrNull(String s) {
        String t = trim(s);
        return t.isBlank() ? null : t;
    }
}
