package br.com.vilareal.pje.infrastructure.browser;

import com.microsoft.playwright.Page;
import org.springframework.util.StringUtils;

/**
 * Detecção heurística de páginas bloqueantes (enrollment QR, gov.br exclusivo).
 */
final class PjeBrowserPreconditions {

    private PjeBrowserPreconditions() {}

    static void validarPosCredencial(Page page) {
        String html = page.content().toLowerCase();
        String url = page.url() != null ? page.url().toLowerCase() : "";

        if (somenteGovBr(html, url, page)) {
            throw new PjeBrowserPreconditionException(PjeBrowserPreconditionException.MSG_SOMENTE_GOVBR);
        }
        if (paginaEnrollment(html, page)) {
            throw new PjeBrowserPreconditionException(PjeBrowserPreconditionException.MSG_ENROLLMENT);
        }
    }

    static void selecionarMetodoUsuarioSenhaSeNecessario(Page page) {
        if (camposLoginVisiveis(page)) {
            return;
        }
        if (somenteGovBr(page.content().toLowerCase(), page.url().toLowerCase(), page)) {
            throw new PjeBrowserPreconditionException(PjeBrowserPreconditionException.MSG_SOMENTE_GOVBR);
        }
        try {
            PjeTrt18Locators.opcaoUsuarioSenha(page).click();
            PjeBrowserWaits.aguardarNavegacao(page, 20_000);
        } catch (RuntimeException e) {
            if (!camposLoginVisiveis(page) && somenteGovBr(page.content().toLowerCase(), page.url().toLowerCase(), page)) {
                throw new PjeBrowserPreconditionException(PjeBrowserPreconditionException.MSG_SOMENTE_GOVBR);
            }
        }
    }

    static boolean paginaEnrollment(String htmlLower, Page page) {
        if (PjeTrt18Locators.campoOtp(page).isVisible()) {
            return false;
        }
        return contemIndicioEnrollment(htmlLower);
    }

    static boolean contemIndicioEnrollment(String htmlLower) {
        if (!StringUtils.hasText(htmlLower)) {
            return false;
        }
        boolean qr = htmlLower.contains("qr code")
                || htmlLower.contains("código qr")
                || htmlLower.contains("codigo qr")
                || htmlLower.contains("leia o qr")
                || htmlLower.contains("escaneie")
                || htmlLower.contains("configurar o aplicativo")
                || htmlLower.contains("configure o aplicativo")
                || htmlLower.contains("mobile authenticator")
                || htmlLower.contains("otpauth://")
                || htmlLower.contains("enrollment")
                || htmlLower.contains("não consegue ler o qr")
                || htmlLower.contains("nao consegue ler o qr");
        boolean setup = htmlLower.contains("configurar autenticação")
                || htmlLower.contains("configurar autenticacao")
                || htmlLower.contains("registrar dispositivo")
                || htmlLower.contains("adicionar autenticador");
        return qr || setup;
    }

    static boolean somenteGovBr(String htmlLower, String urlLower, Page page) {
        boolean govBrDestaque = htmlLower.contains("gov.br")
                || htmlLower.contains("entrar com gov")
                || htmlLower.contains("login único")
                || htmlLower.contains("login unico")
                || urlLower.contains("gov.br");
        boolean temUsuarioSenha = camposLoginVisiveis(page);
        boolean temOpcaoUsuarioSenha = false;
        try {
            temOpcaoUsuarioSenha = PjeTrt18Locators.opcaoUsuarioSenha(page).isVisible();
        } catch (RuntimeException ignored) {
            // sem tile de usuário/senha
        }
        return govBrDestaque && !temUsuarioSenha && !temOpcaoUsuarioSenha;
    }

    private static boolean camposLoginVisiveis(Page page) {
        try {
            return PjeTrt18Locators.campoUsuario(page).isVisible()
                    && PjeTrt18Locators.campoSenha(page).isVisible();
        } catch (RuntimeException e) {
            return false;
        }
    }
}
