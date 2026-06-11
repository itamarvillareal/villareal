package br.com.vilareal.pje.infrastructure.browser;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.LoadState;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Esperas robustas para portais JSF/PrimeFaces e redirects SSO (Keycloak PDPJ).
 */
final class PjeBrowserWaits {

    private static final Logger log = LoggerFactory.getLogger(PjeBrowserWaits.class);

    private PjeBrowserWaits() {}

    static void aguardarNavegacao(Page page, int timeoutMs) {
        page.waitForLoadState(LoadState.DOMCONTENTLOADED);
        try {
            page.waitForLoadState(
                    LoadState.NETWORKIDLE,
                    new Page.WaitForLoadStateOptions().setTimeout(Math.min(timeoutMs, 20_000)));
        } catch (RuntimeException e) {
            log.debug("NETWORKIDLE não atingido (comum em portais JSF): {}", e.getMessage());
        }
    }

    static void aguardarJsfSettle(Page page, int jsfSettleMs) {
        if (jsfSettleMs <= 0) {
            return;
        }
        Locator blockUi = page.locator(
                ".ui-blockui, .ui-blockui-content, #ajaxStatus, .ui-ajaxstatus-default");
        try {
            blockUi.first()
                    .waitFor(new Locator.WaitForOptions()
                            .setState(WaitForSelectorState.HIDDEN)
                            .setTimeout(Math.min(jsfSettleMs, 8_000)));
        } catch (RuntimeException ignored) {
            // Nem todo portal exibe overlay de ajax.
        }
        page.waitForTimeout(jsfSettleMs);
    }

    static void aguardarPosNavegacao(Page page, int timeoutMs, int jsfSettleMs) {
        aguardarNavegacao(page, timeoutMs);
        aguardarJsfSettle(page, jsfSettleMs);
    }
}
