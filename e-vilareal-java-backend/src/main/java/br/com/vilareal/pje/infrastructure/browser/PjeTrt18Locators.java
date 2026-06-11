package br.com.vilareal.pje.infrastructure.browser;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
/**
 * Seletores confirmados no fluxo real TRT18 1º grau (Keycloak PDPJ + SPA Angular).
 */
final class PjeTrt18Locators {

    private PjeTrt18Locators() {}

    static Locator botaoEntrarComPdpj(Page page) {
        return page.locator("#btnSsoPdpj");
    }

    static Locator campoUsuario(Page page) {
        return page.locator("input#username, input[name='username']").first();
    }

    static Locator campoSenha(Page page) {
        return page.locator("input#password, input[name='password']").first();
    }

    static Locator botaoKeycloakLogin(Page page) {
        return page.locator("input#kc-login").first();
    }

    static Locator campoOtp(Page page) {
        return page.locator("input#otp, input[name='otp']").first();
    }

    static Locator campoBuscaProcesso(Page page) {
        return page.locator("input#inputNumeroProcesso").first();
    }

    /** Acervo-geral: abre a aba/popup do processo em {@code /pjekz/processo/<id>/detalhe}. */
    static Locator botaoDetalhesProcesso(Page page, String seletorConfiguravel) {
        return page.locator(seletorConfiguravel).first();
    }

    static Locator botaoMenuProcesso(Page page) {
        return page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Menu do processo"))
                .or(page.locator("button:has-text('Menu do processo')"))
                .first();
    }

    static Locator itemBaixarProcessoCompleto(Page page) {
        return page.getByText("Baixar processo completo")
                .or(page.locator(
                        "[role='menuitem']:has-text('Baixar processo completo'), "
                                + ".mat-mdc-menu-item:has-text('Baixar processo completo'), "
                                + "button:has-text('Baixar processo completo')"))
                .first();
    }

    static boolean urlDetalheProcesso(String url) {
        return url != null && url.contains("/pjekz/processo/") && url.contains("/detalhe");
    }

    static Locator opcaoUsuarioSenha(Page page) {
        return page.locator(
                        "a:has-text('Usuário e senha'), button:has-text('Usuário e senha'), "
                                + "a:has-text('Usuario e senha'), button:has-text('Usuario e senha')")
                .first();
    }

    static boolean pareceDominioSso(String url) {
        if (url == null) {
            return false;
        }
        String lower = url.toLowerCase();
        return lower.contains("sso.cloud.pje.jus.br")
                || lower.contains("sso")
                || lower.contains("keycloak")
                || lower.contains("authenticate")
                || lower.contains("auth/realms");
    }

    static boolean urlPainelAutenticado(String url) {
        if (url == null || !url.contains("/pjekz/painel/usuario-externo")) {
            return false;
        }
        // SPA na raiz do host — /primeirograu/pjekz/... é 404
        return !url.contains("/primeirograu/pjekz") && !url.contains("/segundograu/pjekz");
    }
}
