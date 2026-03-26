package br.com.vilareal.auth.application;

import br.com.vilareal.auth.api.dto.LoginRequest;
import br.com.vilareal.auth.api.dto.LoginResponse;
import br.com.vilareal.auth.api.dto.UsuarioLogadoDto;
import br.com.vilareal.security.JwtService;
import br.com.vilareal.usuario.infrastructure.persistence.entity.PerfilEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuthApplicationService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UsuarioRepository usuarioRepository;

    public AuthApplicationService(
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            UsuarioRepository usuarioRepository) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest req) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        req.getLogin().trim().toLowerCase(),
                        req.getSenha()));
        SecurityContextHolder.getContext().setAuthentication(auth);
        UserDetails ud = (UserDetails) auth.getPrincipal();
        UsuarioEntity u = usuarioRepository.findWithPerfisByLoginIgnoreCase(ud.getUsername())
                .orElseThrow();

        LoginResponse res = new LoginResponse();
        res.setAccessToken(jwtService.generateToken(u.getId(), u.getLogin()));
        res.setUsuario(toLogado(u));
        return res;
    }

    @Transactional(readOnly = true)
    public UsuarioLogadoDto me(String login) {
        UsuarioEntity u = usuarioRepository.findWithPerfisByLoginIgnoreCase(login)
                .orElseThrow();
        return toLogado(u);
    }

    private static UsuarioLogadoDto toLogado(UsuarioEntity u) {
        UsuarioLogadoDto d = new UsuarioLogadoDto();
        d.setId(u.getId());
        d.setNome(u.getNome());
        d.setLogin(u.getLogin());
        if (u.getPerfis() != null) {
            d.setPerfilIds(u.getPerfis().stream().map(PerfilEntity::getId).sorted().toList());
        } else {
            d.setPerfilIds(List.of());
        }
        return d;
    }
}
