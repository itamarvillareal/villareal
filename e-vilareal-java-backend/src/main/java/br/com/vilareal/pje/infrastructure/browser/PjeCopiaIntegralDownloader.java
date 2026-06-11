package br.com.vilareal.pje.infrastructure.browser;

import br.com.vilareal.pje.config.PjeTrt18Properties;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Download;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;

/**
 * Cópia integral TRT18: Detalhes do Processo → aba detalhe → Menu do processo → Baixar processo completo.
 */
final class PjeCopiaIntegralDownloader {

    private static final Logger log = LoggerFactory.getLogger(PjeCopiaIntegralDownloader.class);

    /** Tempo curto para detectar popup; se não abrir, assume navegação na mesma aba. */
    private static final int POPUP_DETECT_MS = 8_000;

    private PjeCopiaIntegralDownloader() {}

    static byte[] baixarComRetry(
            BrowserContext context,
            Page paginaAcervo,
            Locator botaoDetalhesProcesso,
            PjeTrt18Properties properties) {
        int max = Math.max(1, properties.getCopiaIntegralMaxTentativas());
        int timeout = properties.getCopiaIntegralDownloadTimeoutMs();
        int pause = properties.getCopiaIntegralRetryPauseMs();

        Page paginaProcesso = capturarPaginaDetalheProcesso(context, paginaAcervo, botaoDetalhesProcesso, timeout);
        boolean popupSeparado = paginaProcesso != paginaAcervo;

        RuntimeException ultima = null;
        try {
            for (int tentativa = 1; tentativa <= max; tentativa++) {
                try {
                    log.info("PJe: cópia integral download tentativa {}/{}", tentativa, max);
                    Download download = paginaProcesso.waitForDownload(
                            new Page.WaitForDownloadOptions().setTimeout(timeout),
                            () -> acionarMenuBaixarProcessoCompleto(paginaProcesso, timeout));
                    byte[] bytes = lerBytesDownload(download);
                    log.info(
                            "PJe: cópia integral baixada ({} bytes, arquivo={})",
                            bytes.length,
                            download.suggestedFilename());
                    return bytes;
                } catch (RuntimeException e) {
                    ultima = e;
                    log.warn("PJe: cópia integral tentativa {} falhou: {}", tentativa, e.getMessage());
                    if (tentativa < max) {
                        paginaProcesso.waitForTimeout(pause);
                    }
                }
            }
            throw new IllegalStateException(
                    "Cópia integral não baixou após "
                            + max
                            + " tentativas (timeout "
                            + timeout
                            + "ms cada). "
                            + "Fluxo: Detalhes do Processo → Menu do processo → Baixar processo completo. "
                            + "Verifique app.pje.trt18.copia-integral-button-selector e artefatos em "
                            + "app.pje.browser.trace-dir.",
                    ultima);
        } finally {
            if (popupSeparado && !paginaProcesso.isClosed()) {
                try {
                    paginaProcesso.close();
                    log.info("PJe: popup/aba do processo fechada");
                } catch (RuntimeException ignored) {
                    // já fechada
                }
            }
        }
    }

    private static Page capturarPaginaDetalheProcesso(
            BrowserContext context,
            Page paginaAcervo,
            Locator botaoDetalhesProcesso,
            int timeoutMs) {
        botaoDetalhesProcesso.waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(timeoutMs));

        int popupTimeout = Math.min(POPUP_DETECT_MS, timeoutMs);
        Page paginaProcesso;
        try {
            paginaProcesso = context.waitForPage(
                    new BrowserContext.WaitForPageOptions().setTimeout(popupTimeout),
                    botaoDetalhesProcesso::click);
            log.info("PJe: popup/nova aba do processo capturada (url={})", paginaProcesso.url());
        } catch (RuntimeException e) {
            // waitForPage já disparou o clique; navegação tende a ser na mesma aba
            log.info("PJe: sem popup detectado — aguardando detalhe na mesma aba");
            paginaProcesso = paginaAcervo;
        }

        PjeTrt18AngularWaits.aguardarUrl(
                paginaProcesso, PjeTrt18AngularWaits.URL_DETALHE_POPUP_GLOB, timeoutMs);
        log.info("PJe: página detalhe do processo pronta (url={})", paginaProcesso.url());
        return paginaProcesso;
    }

    private static void acionarMenuBaixarProcessoCompleto(Page paginaProcesso, int timeoutMs) {
        var menu = PjeTrt18Locators.botaoMenuProcesso(paginaProcesso);
        menu.waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(timeoutMs));
        menu.click();
        log.info("PJe: Menu do processo aberto");

        var itemBaixar = PjeTrt18Locators.itemBaixarProcessoCompleto(paginaProcesso);
        itemBaixar.waitFor(new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(timeoutMs));
        itemBaixar.click();
        log.info("PJe: Baixar processo completo acionado");
    }

    private static byte[] lerBytesDownload(Download download) {
        try {
            byte[] bytes = Files.readAllBytes(download.path());
            if (bytes.length == 0) {
                throw new IllegalStateException("Download da cópia integral veio vazio.");
            }
            return bytes;
        } catch (java.io.IOException io) {
            throw new IllegalStateException("Falha ao ler download da cópia integral: " + io.getMessage(), io);
        }
    }
}
