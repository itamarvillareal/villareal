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

import java.util.stream.Collectors;

@Service
public class UsuarioUserDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    public UsuarioUserDetailsService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String login) throws UsernameNotFoundException {
        UsuarioEntity u = usuarioRepository.findWithPerfisByLoginIgnoreCase(login.trim().toLowerCase())
                .orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado."));
        if (!Boolean.TRUE.equals(u.getAtivo())) {
            throw new UsernameNotFoundException("Usuário inativo.");
        }
        var authorities = u.getPerfis().stream()
                .map(p -> new SimpleGrantedAuthority("ROLE_" + p.getCodigo()))
                .collect(Collectors.toSet());
        return User.builder()
                .username(u.getLogin())
                .password(u.getSenhaHash())
                .authorities(authorities)
                .build();
    }
}
