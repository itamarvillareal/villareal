package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
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
 * Itamar: todos os bancos. Karla: BB (3), CEF (5), CORA (26) e Sicoob VRV (29).
 */
@Service
public class FinanceiroExtratoAcessoService {

    /** Banco do Brasil */
    public static final int NUMERO_BANCO_BB = 3;
    /** Caixa Econômica Federal */
    public static final int NUMERO_BANCO_CEF = 5;
    /** Cora */
    public static final int NUMERO_BANCO_CORA = 26;
    /** Sicoob VRV */
    public static final int NUMERO_BANCO_SICOOB_VRV = 29;

    /** Conta Escritório — lançamentos vinculados aqui são visíveis/editáveis sem acesso ao extrato do banco. */
    public static final String CODIGO_CONTA_ESCRITORIO = "A";

    private static final Set<Integer> BANCOS_KARLA =
            Set.of(NUMERO_BANCO_BB, NUMERO_BANCO_CEF, NUMERO_BANCO_CORA, NUMERO_BANCO_SICOOB_VRV);
    private static final long USUARIO_ITAMAR_ID = 1L;
    private static final long USUARIO_KARLA_ID = 2L;

    private final UsuarioRepository usuarioRepository;
    private final ContaContabilRepository contaContabilRepository;

    public FinanceiroExtratoAcessoService(
            UsuarioRepository usuarioRepository, ContaContabilRepository contaContabilRepository) {
        this.usuarioRepository = usuarioRepository;
        this.contaContabilRepository = contaContabilRepository;
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

    /** Leitura: extrato do banco permitido ou lançamento já na Conta Escritório (consolidado A). */
    public void assertAcessoLeituraLancamento(br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity lancamento) {
        if (lancamento == null) {
            return;
        }
        if (lancamentoContaEscritorio(lancamento)) {
            return;
        }
        assertAcessoExtratoBanco(lancamento.getNumeroBanco());
    }

    /**
     * Alteração: extrato permitido, lançamento já em Escritório, ou vínculo para Conta Escritório
     * (ex.: Karla classifica lançamento BTG → A sem abrir extrato BTG).
     */
    public void assertAcessoAlteracaoLancamento(
            br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity lancamento,
            Long novaContaContabilId) {
        if (lancamento == null) {
            return;
        }
        if (numerosBancosPermitidos().isEmpty()) {
            return;
        }
        if (lancamentoContaEscritorio(lancamento)) {
            return;
        }
        if (contaContabilEhEscritorio(novaContaContabilId)) {
            return;
        }
        assertAcessoExtratoBanco(lancamento.getNumeroBanco());
    }

    public boolean lancamentoContaEscritorio(
            br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity lancamento) {
        if (lancamento == null || lancamento.getContaContabil() == null) {
            return false;
        }
        return CODIGO_CONTA_ESCRITORIO.equalsIgnoreCase(
                String.valueOf(lancamento.getContaContabil().getCodigo()).trim());
    }

    public boolean contaContabilEhEscritorio(Long contaContabilId) {
        if (contaContabilId == null) {
            return false;
        }
        return contaContabilRepository
                .findById(contaContabilId)
                .map(c -> CODIGO_CONTA_ESCRITORIO.equalsIgnoreCase(String.valueOf(c.getCodigo()).trim()))
                .orElse(false);
    }

    public boolean extratoBloqueadoParaUsuario(Integer numeroBanco) {
        if (numeroBanco == null) {
            return false;
        }
        Optional<Set<Integer>> permitidos = numerosBancosPermitidos();
        return permitidos.isPresent() && !permitidos.get().contains(numeroBanco);
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
