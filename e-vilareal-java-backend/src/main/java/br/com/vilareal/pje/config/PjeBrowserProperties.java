package br.com.vilareal.pje.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.nio.file.Path;

/**
 * Configuração do driver Playwright do PJe (habilitado explicitamente em produção/dev com browser).
 */
@Component
@ConfigurationProperties(prefix = "app.pje.browser")
public class PjeBrowserProperties {

    /** false = {@link br.com.vilareal.pje.application.StubPjeBrowserDriver}; true = Playwright. */
    private boolean enabled = false;

    /** Headless por padrão; use false para depurar login localmente. */
    private boolean headless = true;

    /** Timeout padrão de locators/navegação (ms). */
    private int timeoutMs = 45_000;

    /** Espera extra após postbacks JSF/PrimeFaces (ms). */
    private int jsfSettleMs = 1_500;

    /** Diretório para downloads do browser (modo leitura — só leitura/baixar). */
    private String downloadDir = System.getProperty("java.io.tmpdir") + "/pje-downloads";

    /** Traces Playwright + PNG/HTML de falha por tentativa. */
    private String traceDir = System.getProperty("java.io.tmpdir") + "/pje-traces";

    /** Pausa em modo headed após falha, antes de fechar o browser (ms). */
    private int headedFailurePauseMs = 8_000;

    /** Persistência opcional de sessão Playwright (storageState JSON por grau+login). */
    private String storageStateDir = System.getProperty("java.io.tmpdir") + "/pje-storage-state";

    /**
     * Proxy SOCKS5/HTTP do Chromium (ex.: {@code socks5://100.x.x.x:1080}).
     * Vazio = tráfego direto do host do container.
     */
    private String proxy = "";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isHeadless() {
        return headless;
    }

    public void setHeadless(boolean headless) {
        this.headless = headless;
    }

    public int getTimeoutMs() {
        return timeoutMs;
    }

    public void setTimeoutMs(int timeoutMs) {
        this.timeoutMs = timeoutMs;
    }

    public int getJsfSettleMs() {
        return jsfSettleMs;
    }

    public void setJsfSettleMs(int jsfSettleMs) {
        this.jsfSettleMs = jsfSettleMs;
    }

    public String getDownloadDir() {
        return downloadDir;
    }

    public void setDownloadDir(String downloadDir) {
        this.downloadDir = downloadDir;
    }

    public Path downloadDirPath() {
        return Path.of(downloadDir);
    }

    public String getTraceDir() {
        return traceDir;
    }

    public void setTraceDir(String traceDir) {
        this.traceDir = traceDir;
    }

    public Path traceDirPath() {
        return Path.of(traceDir);
    }

    public int getHeadedFailurePauseMs() {
        return headedFailurePauseMs;
    }

    public void setHeadedFailurePauseMs(int headedFailurePauseMs) {
        this.headedFailurePauseMs = headedFailurePauseMs;
    }

    public String getStorageStateDir() {
        return storageStateDir;
    }

    public void setStorageStateDir(String storageStateDir) {
        this.storageStateDir = storageStateDir;
    }

    public Path storageStateDirPath() {
        return Path.of(storageStateDir);
    }

    public String getProxy() {
        return proxy;
    }

    public void setProxy(String proxy) {
        this.proxy = proxy;
    }
}
