package br.com.vilareal.usuario.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import br.com.vilareal.usuario.model.TipoUsuario;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Set;
import java.util.function.Supplier;

/**
 * Executa código com o SecurityContext da usuária-assistente Júlia (credencial de serviço interna).
 * Não usa {@code POST /api/auth/login} — contas com {@code permite_login=false}.
 */
@Service
public class JuliaAssistenteContextService {

    private final UsuarioRepository usuarioRepository;
    private final String loginConfigurado;

    public JuliaAssistenteContextService(
            UsuarioRepository usuarioRepository,
            @Value("${julia.assistente.login:julia.assistente}") String loginConfigurado) {
        this.usuarioRepository = usuarioRepository;
        this.loginConfigurado = loginConfigurado;
    }

    @Transactional(readOnly = true)
    public Long idJuliaAssistente() {
        return carregarJulia().getId();
    }

    @Transactional(readOnly = true)
    public <T> T executarComoJulia(Supplier<T> acao) {
        SecurityContext anterior = SecurityContextHolder.getContext();
        try {
            SecurityContext ctx = SecurityContextHolder.createEmptyContext();
            ctx.setAuthentication(criarAuthentication(carregarJulia()));
            SecurityContextHolder.setContext(ctx);
            return acao.get();
        } finally {
            SecurityContextHolder.setContext(anterior);
        }
    }

    public void executarComoJulia(Runnable acao) {
        executarComoJulia(() -> {
            acao.run();
            return null;
        });
    }

    private UsuarioEntity carregarJulia() {
        String login = StringUtils.hasText(loginConfigurado) ? loginConfigurado.trim().toLowerCase() : "julia.assistente";
        UsuarioEntity u = usuarioRepository
                .findWithPerfilByLoginIgnoreCase(login)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuária-assistente não encontrada (login=" + login + "). Execute a migration V83."));
        if (u.getTipo() != TipoUsuario.ASSISTENTE_IA) {
            throw new IllegalStateException("Usuário " + login + " não está configurado como ASSISTENTE_IA.");
        }
        if (!Boolean.TRUE.equals(u.getAtivo())) {
            throw new IllegalStateException("Usuária-assistente inativa.");
        }
        return u;
    }

    private static UsernamePasswordAuthenticationToken criarAuthentication(UsuarioEntity u) {
        if (u.getPerfil() == null) {
            throw new IllegalStateException("Usuária-assistente sem perfil.");
        }
        var authorities = Set.of(new SimpleGrantedAuthority("ROLE_" + u.getPerfil().getCodigo()));
        return new UsernamePasswordAuthenticationToken(u.getLogin(), null, authorities);
    }
}
