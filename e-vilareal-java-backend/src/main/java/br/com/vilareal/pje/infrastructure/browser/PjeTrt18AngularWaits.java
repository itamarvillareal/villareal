package br.com.vilareal.pje.infrastructure.browser;

import com.microsoft.playwright.Page;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Esperas por URL/elemento no SPA Angular do PJe (sem sleep fixo como estratégia principal).
 */
final class PjeTrt18AngularWaits {

    private static final Logger log = LoggerFactory.getLogger(PjeTrt18AngularWaits.class);

    static final String URL_KEYCLOAK_GLOB = "**/sso.cloud.pje.jus.br/**";
    static final String URL_PAINEL_GLOB = "**/pjekz/painel/usuario-externo**";
    static final String URL_ACERVO_GLOB = "**/acervo-geral/**";
    static final String URL_DETALHE_POPUP_GLOB = "**/pjekz/processo/**/detalhe**";

    private PjeTrt18AngularWaits() {}

    static void aguardarUrl(Page page, String glob, int timeoutMs) {
        page.waitForURL(glob, new Page.WaitForURLOptions().setTimeout(timeoutMs));
        log.debug("PJe: URL atingida {} (atual={})", glob, page.url());
    }

    static void aguardarAcervoComCnj(Page page, String cnj, int timeoutMs) {
        String digitos = PjeTrt18CnjUtil.somenteDigitos(cnj);
        page.waitForURL(
                url -> url.contains("/acervo-geral/") && url.replaceAll("\\D", "").contains(digitos),
                new Page.WaitForURLOptions().setTimeout(timeoutMs));
    }
}
