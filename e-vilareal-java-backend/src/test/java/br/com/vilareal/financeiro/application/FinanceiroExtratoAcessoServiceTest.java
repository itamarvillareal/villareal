package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
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

    @Mock
    private ContaContabilRepository contaContabilRepository;

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
    void karla_apenasBbCefCoraESicoobVrv() {
        autenticar("karla.pedroza");
        when(usuarioRepository.findWithPerfilByLoginIgnoreCase("karla.pedroza"))
                .thenReturn(Optional.of(usuario(2L, "karla.pedroza")));

        assertThat(service.numerosBancosPermitidos()).hasValue(Set.of(3, 903, 5, 26, 29));
        assertThatCode(() -> service.assertAcessoExtratoBanco(3)).doesNotThrowAnyException();
        assertThatCode(() -> service.assertAcessoExtratoBanco(903)).doesNotThrowAnyException();
        assertThatCode(() -> service.assertAcessoExtratoBanco(5)).doesNotThrowAnyException();
        assertThatCode(() -> service.assertAcessoExtratoBanco(26)).doesNotThrowAnyException();
        assertThatCode(() -> service.assertAcessoExtratoBanco(29)).doesNotThrowAnyException();
        assertThatThrownBy(() -> service.assertAcessoExtratoBanco(1))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void karla_podeAlterarLancamentoBtg_vinculandoContaEscritorio() {
        autenticar("karla.pedroza");
        when(usuarioRepository.findWithPerfilByLoginIgnoreCase("karla.pedroza"))
                .thenReturn(Optional.of(usuario(2L, "karla.pedroza")));
        when(contaContabilRepository.findById(10L)).thenReturn(Optional.of(contaEscritorio(10L)));

        LancamentoFinanceiroEntity l = lancamentoBanco(21, contaN(5L));
        assertThatCode(() -> service.assertAcessoAlteracaoLancamento(l, 10L)).doesNotThrowAnyException();
    }

    @Test
    void karla_podeLerLancamentoContaEscritorio_mesmoDeBancoBloqueado() {
        autenticar("karla.pedroza");

        LancamentoFinanceiroEntity l = lancamentoBanco(21, contaEscritorio(10L));
        assertThatCode(() -> service.assertAcessoLeituraLancamento(l)).doesNotThrowAnyException();
    }

    @Test
    void karla_naoAlteraLancamentoBtg_semVincularEscritorio() {
        autenticar("karla.pedroza");
        when(usuarioRepository.findWithPerfilByLoginIgnoreCase("karla.pedroza"))
                .thenReturn(Optional.of(usuario(2L, "karla.pedroza")));
        when(contaContabilRepository.findById(5L)).thenReturn(Optional.of(contaN(5L)));

        LancamentoFinanceiroEntity l = lancamentoBanco(21, contaN(5L));
        assertThatThrownBy(() -> service.assertAcessoAlteracaoLancamento(l, 5L))
                .isInstanceOf(AccessDeniedException.class);
    }

    private static ContaContabilEntity contaEscritorio(long id) {
        ContaContabilEntity c = new ContaContabilEntity();
        c.setId(id);
        c.setCodigo("A");
        c.setNome("Conta Escritório");
        return c;
    }

    private static ContaContabilEntity contaN(long id) {
        ContaContabilEntity c = new ContaContabilEntity();
        c.setId(id);
        c.setCodigo("N");
        c.setNome("Conta Não Identificados");
        return c;
    }

    private static LancamentoFinanceiroEntity lancamentoBanco(int numeroBanco, ContaContabilEntity conta) {
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setId(1L);
        l.setNumeroBanco(numeroBanco);
        l.setContaContabil(conta);
        return l;
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
