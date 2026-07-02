package br.com.vilareal.financeiro.application;

import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceiroExtratoAcessoServiceTest {

    @Mock
    private br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository usuarioRepository;

    @InjectMocks
    private FinanceiroExtratoAcessoService service;

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void itamar_temAcessoTotal() {
        autenticar("itamar");

        assertThat(service.numerosBancosPermitidos()).isEmpty();
        assertThatCode(() -> service.assertAcessoExtratoBanco(1)).doesNotThrowAnyException();
    }

    @Test
    void karla_apenasBbCefECora() {
        autenticar("karla.pedroza");
        when(usuarioRepository.findWithPerfilByLoginIgnoreCase("karla.pedroza"))
                .thenReturn(Optional.of(usuario(2L, "karla.pedroza")));

        assertThat(service.numerosBancosPermitidos()).hasValue(Set.of(3, 5, 26));
        assertThatCode(() -> service.assertAcessoExtratoBanco(3)).doesNotThrowAnyException();
        assertThatCode(() -> service.assertAcessoExtratoBanco(5)).doesNotThrowAnyException();
        assertThatCode(() -> service.assertAcessoExtratoBanco(26)).doesNotThrowAnyException();
        assertThatThrownBy(() -> service.assertAcessoExtratoBanco(1))
                .isInstanceOf(AccessDeniedException.class);
    }

    private static void autenticar(String login) {
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(
                        login, "n/a", List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }

    private static UsuarioEntity usuario(long id, String login) {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(id);
        u.setLogin(login);
        return u;
    }
}
