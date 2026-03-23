package br.com.vilareal.api.service.impl;

import br.com.vilareal.api.dto.UsuarioRequest;
import br.com.vilareal.api.dto.UsuarioResponse;
import br.com.vilareal.api.entity.*;
import br.com.vilareal.api.exception.RecursoNaoEncontradoException;
import br.com.vilareal.api.exception.RegraNegocioException;
import br.com.vilareal.api.repository.*;
import br.com.vilareal.api.service.UsuarioService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UsuarioServiceImpl implements UsuarioService {
    private final UsuarioRepository usuarioRepository;
    private final CadastroPessoasRepository cadastroPessoasRepository;
    private final PerfilRepository perfilRepository;
    private final UsuarioPerfilRepository usuarioPerfilRepository;

    public UsuarioServiceImpl(
            UsuarioRepository usuarioRepository,
            CadastroPessoasRepository cadastroPessoasRepository,
            PerfilRepository perfilRepository,
            UsuarioPerfilRepository usuarioPerfilRepository) {
        this.usuarioRepository = usuarioRepository;
        this.cadastroPessoasRepository = cadastroPessoasRepository;
        this.perfilRepository = perfilRepository;
        this.usuarioPerfilRepository = usuarioPerfilRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<UsuarioResponse> listar() {
        return usuarioRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public UsuarioResponse criar(UsuarioRequest request) {
        String login = normalize(request.getLogin());
        if (usuarioRepository.existsByLogin(login)) {
            throw new RegraNegocioException("Já existe usuário com este login.");
        }
        Usuario u = new Usuario();
        applyRequest(u, request, null);
        u.setLogin(login);
        return toResponse(usuarioRepository.save(u));
    }

    @Override
    @Transactional
    public UsuarioResponse atualizar(Long id, UsuarioRequest request) {
        Usuario u = usuarioRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + id));
        String login = normalize(request.getLogin());
        if (usuarioRepository.existsByLoginAndIdNot(login, id)) {
            throw new RegraNegocioException("Já existe usuário com este login.");
        }
        applyRequest(u, request, id);
        u.setLogin(login);
        return toResponse(usuarioRepository.save(u));
    }

    @Override
    @Transactional
    public UsuarioResponse alterarAtivo(Long id, boolean ativo) {
        Usuario u = usuarioRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + id));
        u.setAtivo(ativo);
        return toResponse(usuarioRepository.save(u));
    }

    @Override
    @Transactional
    public UsuarioResponse definirPerfis(Long id, List<Long> perfilIds) {
        Usuario usuario = usuarioRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + id));
        usuarioPerfilRepository.deleteByUsuario_Id(id);
        List<Long> ids = perfilIds == null ? List.of() : perfilIds.stream().distinct().toList();
        for (Long perfilId : ids) {
            Perfil perfil = perfilRepository.findById(perfilId)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Perfil não encontrado: " + perfilId));
            UsuarioPerfil rel = new UsuarioPerfil();
            rel.setId(new UsuarioPerfilId(usuario.getId(), perfil.getId()));
            rel.setUsuario(usuario);
            rel.setPerfil(perfil);
            usuarioPerfilRepository.save(rel);
        }
        return toResponse(usuario);
    }

    private void applyRequest(Usuario u, UsuarioRequest request, Long id) {
        u.setNome(trim(request.getNome()));
        u.setApelido(trimOrNull(request.getApelido()));
        if (request.getSenhaHash() != null && !request.getSenhaHash().isBlank()) {
            u.setSenhaHash(request.getSenhaHash().trim());
        }
        u.setAtivo(request.getAtivo() == null ? (id == null ? Boolean.TRUE : u.getAtivo()) : request.getAtivo());
        if (request.getPessoaId() != null) {
            CadastroPessoa pessoa = cadastroPessoasRepository.findById(request.getPessoaId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Pessoa não encontrada: " + request.getPessoaId()));
            u.setPessoa(pessoa);
        } else {
            u.setPessoa(null);
        }
    }

    private UsuarioResponse toResponse(Usuario u) {
        UsuarioResponse r = new UsuarioResponse();
        r.setId(u.getId());
        r.setPessoaId(u.getPessoa() != null ? u.getPessoa().getId() : null);
        r.setNome(u.getNome());
        r.setApelido(u.getApelido());
        r.setLogin(u.getLogin());
        r.setAtivo(u.getAtivo());
        r.setUltimoLoginEm(u.getUltimoLoginEm());
        r.setCreatedAt(u.getCreatedAt());
        r.setUpdatedAt(u.getUpdatedAt());
        List<Long> perfilIds = new ArrayList<>();
        for (UsuarioPerfil rel : usuarioPerfilRepository.findByUsuario_Id(u.getId())) {
            perfilIds.add(rel.getPerfil().getId());
        }
        r.setPerfilIds(perfilIds);
        return r;
    }

    private static String normalize(String s) { return trim(s).toLowerCase(); }
    private static String trim(String s) { return String.valueOf(s == null ? "" : s).trim(); }
    private static String trimOrNull(String s) {
        String t = trim(s);
        return t.isBlank() ? null : t;
    }
}
