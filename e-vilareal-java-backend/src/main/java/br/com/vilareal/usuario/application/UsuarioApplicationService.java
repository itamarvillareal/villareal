package br.com.vilareal.usuario.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.usuario.api.dto.UsuarioResponse;
import br.com.vilareal.usuario.api.dto.UsuarioWriteRequest;
import br.com.vilareal.usuario.infrastructure.persistence.entity.PerfilEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.UsuarioSpecifications;
import br.com.vilareal.usuario.infrastructure.persistence.repository.PerfilRepository;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class UsuarioApplicationService {

    private static final String PLACEHOLDER_SENHA = "sem-hash-definido";
    /** Perfil USUARIO (V1__init). Novos cadastros passam a usar este perfil por defeito. */
    private static final long PERFIL_PADRAO_NOVO_USUARIO = 2L;

    private final UsuarioRepository usuarioRepository;
    private final PessoaRepository pessoaRepository;
    private final PerfilRepository perfilRepository;
    private final PasswordEncoder passwordEncoder;

    public UsuarioApplicationService(
            UsuarioRepository usuarioRepository,
            PessoaRepository pessoaRepository,
            PerfilRepository perfilRepository,
            PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.pessoaRepository = pessoaRepository;
        this.perfilRepository = perfilRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<UsuarioResponse> listar() {
        return usuarioRepository.findAllForListing().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<UsuarioResponse> listarPaginado(
            boolean apenasAtivos,
            String nome,
            String login,
            Long codigoUsuario,
            Long pessoaId,
            String nomePessoa,
            Pageable pageable) {
        var spec = UsuarioSpecifications.comFiltros(
                apenasAtivos ? true : null,
                nome,
                login,
                codigoUsuario,
                pessoaId,
                nomePessoa);
        return usuarioRepository.findAll(spec, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public UsuarioResponse buscar(Long id) {
        UsuarioEntity u = usuarioRepository.findWithPerfilById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + id));
        return toResponse(u);
    }

    @Transactional
    public UsuarioResponse criar(UsuarioWriteRequest req) {
        if (req.getPessoaId() == null) {
            throw new BusinessRuleException("pessoaId é obrigatório para criar usuário.");
        }
        PessoaEntity pessoa = pessoaRepository.findById(req.getPessoaId())
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + req.getPessoaId()));
        if (usuarioRepository.existsByPessoa_Id(req.getPessoaId())) {
            throw new BusinessRuleException("Já existe usuário vinculado a esta pessoa.");
        }
        String login = normalizeLogin(req.getLogin());
        if (usuarioRepository.existsByLoginIgnoreCase(login)) {
            throw new BusinessRuleException("Já existe usuário com este login.");
        }
        String apelidoCriacao = trimToNull(req.getApelido());
        if (!StringUtils.hasText(apelidoCriacao)) {
            throw new BusinessRuleException("Apelido é obrigatório ao cadastrar usuário.");
        }

        UsuarioEntity u = new UsuarioEntity();
        u.setPessoa(pessoa);
        u.setNome(req.getNome().trim());
        u.setApelido(apelidoCriacao);
        u.setLogin(login);
        u.setAtivo(req.getAtivo() != null ? req.getAtivo() : true);
        u.setSenhaHash(resolverSenhaHashCriacao(req));
        u.setPerfil(perfilRepository
                .findById(PERFIL_PADRAO_NOVO_USUARIO)
                .orElseThrow(() -> new ResourceNotFoundException("Perfil padrão não encontrado: " + PERFIL_PADRAO_NOVO_USUARIO)));
        u = usuarioRepository.save(u);
        return toResponse(usuarioRepository.findWithPerfilById(u.getId()).orElse(u));
    }

    @Transactional
    public UsuarioResponse atualizar(Long id, UsuarioWriteRequest req) {
        UsuarioEntity u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + id));
        if (req.getPessoaId() != null && !req.getPessoaId().equals(u.getPessoa().getId())) {
            if (!pessoaRepository.existsById(req.getPessoaId())) {
                throw new ResourceNotFoundException("Pessoa não encontrada: " + req.getPessoaId());
            }
            if (usuarioRepository.existsByPessoa_IdAndIdNot(req.getPessoaId(), id)) {
                throw new BusinessRuleException("Já existe usuário vinculado a esta pessoa.");
            }
            u.setPessoa(pessoaRepository.getReferenceById(req.getPessoaId()));
        }
        String login = normalizeLogin(req.getLogin());
        if (usuarioRepository.existsByLoginIgnoreCaseAndIdNot(login, id)) {
            throw new BusinessRuleException("Já existe usuário com este login.");
        }
        u.setNome(req.getNome().trim());
        u.setApelido(trimToNull(req.getApelido()));
        u.setLogin(login);
        if (req.getAtivo() != null) {
            u.setAtivo(req.getAtivo());
        }
        String novoHash = resolverSenhaHashAtualizacao(req, u.getSenhaHash());
        if (novoHash != null) {
            u.setSenhaHash(novoHash);
        }
        u = usuarioRepository.save(u);
        return toResponse(usuarioRepository.findWithPerfilById(u.getId()).orElse(u));
    }

    @Transactional
    public UsuarioResponse alterarAtivo(Long id, boolean ativo) {
        UsuarioEntity u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + id));
        u.setAtivo(ativo);
        u = usuarioRepository.save(u);
        return toResponse(usuarioRepository.findWithPerfilById(u.getId()).orElse(u));
    }

    @Transactional
    public UsuarioResponse definirPerfis(Long id, List<Long> perfilIds) {
        UsuarioEntity u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + id));
        List<Long> ids = perfilIds == null ? List.of() : perfilIds.stream().distinct().toList();
        if (ids.isEmpty()) {
            throw new BusinessRuleException("Informe exatamente um perfil (array JSON com um id, ex.: [2]).");
        }
        if (ids.size() > 1) {
            throw new BusinessRuleException("Cada usuário pode ter apenas um perfil.");
        }
        Long pid = ids.getFirst();
        PerfilEntity perfil = perfilRepository
                .findById(pid)
                .orElseThrow(() -> new ResourceNotFoundException("Perfil não encontrado: " + pid));
        u.setPerfil(perfil);
        u = usuarioRepository.save(u);
        return toResponse(usuarioRepository.findWithPerfilById(u.getId()).orElse(u));
    }

    private String resolverSenhaHashCriacao(UsuarioWriteRequest req) {
        if (StringUtils.hasText(req.getSenha())) {
            if (req.getSenha().length() < 4) {
                throw new BusinessRuleException("Senha deve ter pelo menos 4 caracteres.");
            }
            return passwordEncoder.encode(req.getSenha());
        }
        if (isBcryptHash(req.getSenhaHash())) {
            return req.getSenhaHash().trim();
        }
        if (!StringUtils.hasText(req.getSenhaHash()) || PLACEHOLDER_SENHA.equalsIgnoreCase(req.getSenhaHash().trim())) {
            return passwordEncoder.encode(UUID.randomUUID().toString());
        }
        return passwordEncoder.encode(req.getSenhaHash());
    }

    private String resolverSenhaHashAtualizacao(UsuarioWriteRequest req, String atual) {
        if (StringUtils.hasText(req.getSenha())) {
            if (req.getSenha().length() < 4) {
                throw new BusinessRuleException("Senha deve ter pelo menos 4 caracteres.");
            }
            return passwordEncoder.encode(req.getSenha());
        }
        if (isBcryptHash(req.getSenhaHash())) {
            return req.getSenhaHash().trim();
        }
        if (PLACEHOLDER_SENHA.equalsIgnoreCase(String.valueOf(req.getSenhaHash()).trim())) {
            return null;
        }
        return null;
    }

    private static boolean isBcryptHash(String s) {
        if (s == null) return false;
        String t = s.trim();
        return t.startsWith("$2a$") || t.startsWith("$2b$") || t.startsWith("$2y$");
    }

    private static String normalizeLogin(String login) {
        return login == null ? "" : login.trim().toLowerCase().replaceAll("\\s", "");
    }

    private static String trimToNull(String s) {
        if (s == null || s.isBlank()) return null;
        return s.trim();
    }

    private UsuarioResponse toResponse(UsuarioEntity u) {
        UsuarioResponse r = new UsuarioResponse();
        r.setId(u.getId());
        r.setPessoaId(u.getPessoa() != null ? u.getPessoa().getId() : null);
        r.setNomePessoa(
                u.getPessoa() != null ? Utf8MojibakeUtil.corrigir(u.getPessoa().getNome()) : null);
        r.setNome(Utf8MojibakeUtil.corrigir(u.getNome()));
        r.setApelido(Utf8MojibakeUtil.corrigir(u.getApelido()));
        r.setLogin(u.getLogin());
        r.setAtivo(u.getAtivo());
        r.setPerfilId(u.getPerfil() != null ? u.getPerfil().getId() : null);
        return r;
    }
}
