package br.com.vilareal.security;

import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Service
public class UsuarioUserDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    public UsuarioUserDetailsService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String login) throws UsernameNotFoundException {
        String normalized = login.trim().toLowerCase();
        UsuarioEntity u = usuarioRepository.findWithPerfilByLoginIgnoreCase(normalized)
                .orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado."));
        if (!Boolean.TRUE.equals(u.getAtivo())) {
            throw new UsernameNotFoundException("Usuário inativo.");
        }
        if (u.getPerfil() == null) {
            throw new UsernameNotFoundException("Usuário sem perfil.");
        }
        var authorities = Set.of(new SimpleGrantedAuthority("ROLE_" + u.getPerfil().getCodigo()));
        // Mesmo valor que AuthApplicationService passa ao token (minúsculas), evitando falha de autenticação
        // quando o login guardado na BD difere só em maiúsculas.
        return User.builder()
                .username(normalized)
                .password(u.getSenhaHash())
                .authorities(authorities)
                .build();
    }
}
