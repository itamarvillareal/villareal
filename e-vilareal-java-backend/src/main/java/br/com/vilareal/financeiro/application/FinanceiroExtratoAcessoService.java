package br.com.vilareal.financeiro.application;

import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Restringe visualização/importação de extratos bancários por usuário.
 * Itamar: todos os bancos. Karla: apenas BB (3) e CEF (5).
 */
@Service
public class FinanceiroExtratoAcessoService {

    /** Banco do Brasil */
    public static final int NUMERO_BANCO_BB = 3;
    /** Caixa Econômica Federal */
    public static final int NUMERO_BANCO_CEF = 5;

    private static final Set<Integer> BANCOS_KARLA = Set.of(NUMERO_BANCO_BB, NUMERO_BANCO_CEF);
    private static final long USUARIO_ITAMAR_ID = 1L;
    private static final long USUARIO_KARLA_ID = 2L;

    private final UsuarioRepository usuarioRepository;

    public FinanceiroExtratoAcessoService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    /** Vazio = acesso a todos os bancos; presente = conjunto permitido. */
    public Optional<Set<Integer>> numerosBancosPermitidos() {
        UsuarioEntity u = usuarioAtualOrNull();
        if (temAcessoTotalExtratos(u)) {
            return Optional.empty();
        }
        if (isUsuarioKarla(u)) {
            return Optional.of(BANCOS_KARLA);
        }
        return Optional.empty();
    }

    public void assertAcessoExtratoBanco(Integer numeroBanco) {
        if (numeroBanco == null) {
            return;
        }
        numerosBancosPermitidos().ifPresent(permitidos -> {
            if (!permitidos.contains(numeroBanco)) {
                throw new AccessDeniedException("Sem permissão para acessar o extrato deste banco.");
            }
        });
    }

    public boolean temAcessoTotalExtratos(UsuarioEntity u) {
        if (u == null) {
            return true;
        }
        if (USUARIO_ITAMAR_ID == u.getId()) {
            return true;
        }
        return isLoginItamar(u.getLogin());
    }

    public boolean isUsuarioKarla(UsuarioEntity u) {
        if (u == null) {
            return false;
        }
        if (USUARIO_KARLA_ID == u.getId()) {
            return true;
        }
        return isLoginKarla(u.getLogin());
    }

    private UsuarioEntity usuarioAtualOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        String login = auth.getName();
        if (login == null || login.isBlank()) {
            return null;
        }
        return usuarioRepository.findWithPerfilByLoginIgnoreCase(login).orElse(null);
    }

    private static boolean isLoginItamar(String login) {
        if (login == null) {
            return false;
        }
        String l = login.trim().toLowerCase(Locale.ROOT);
        return "itamar".equals(l) || l.startsWith("itamar.");
    }

    private static boolean isLoginKarla(String login) {
        if (login == null) {
            return false;
        }
        String l = login.trim().toLowerCase(Locale.ROOT);
        return "karla".equals(l) || l.startsWith("karla.");
    }
}
