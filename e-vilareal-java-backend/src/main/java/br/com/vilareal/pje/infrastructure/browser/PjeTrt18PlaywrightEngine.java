package br.com.vilareal.pje.infrastructure.browser;

import br.com.vilareal.pje.application.PjeBrowserSessionState;
import br.com.vilareal.pje.config.PjeBrowserProperties;
import br.com.vilareal.pje.config.PjeTrt18Properties;
import br.com.vilareal.pje.domain.PjeGrau;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.Proxy;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.springframework.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Motor Playwright do PJe TRT18 — login Keycloak PDPJ, busca de processo e cópia integral.
 */
@Service
@ConditionalOnProperty(name = "app.pje.browser.enabled", havingValue = "true")
public class PjeTrt18PlaywrightEngine {

    private static final Logger log = LoggerFactory.getLogger(PjeTrt18PlaywrightEngine.class);

    private static final String USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    private final PjeBrowserProperties browserProperties;
    private final PjeTrt18Properties trt18Properties;
    private final PjeBrowserArtifacts artifacts;
    private final PjeTrt18StorageStateStore storageStateStore;

    private Playwright playwright;
    private Browser browser;
    private BrowserContext context;
    private Page page;
    private PjeGrau grauAtual;
    private String loginAtual;

    PjeTrt18PlaywrightEngine(
            PjeBrowserProperties browserProperties,
            PjeTrt18Properties trt18Properties,
            PjeTrt18StorageStateStore storageStateStore) {
        this.browserProperties = browserProperties;
        this.trt18Properties = trt18Properties;
        this.storageStateStore = storageStateStore;
        this.artifacts = new PjeBrowserArtifacts(browserProperties);
    }

    void abrir(PjeGrau grau, String urlLoginSeam) {
        fechar();
        this.grauAtual = grau;
        artifacts.iniciarTentativa();
        iniciarBrowser(null);

        executarPasso("abrir", () -> {
            page.navigate(urlLoginSeam);
            PjeTrt18Locators.botaoEntrarComPdpj(page)
                    .waitFor(new com.microsoft.playwright.Locator.WaitForOptions()
                            .setState(WaitForSelectorState.VISIBLE)
                            .setTimeout(browserProperties.getTimeoutMs()));
            PjeTrt18Locators.botaoEntrarComPdpj(page).click();
            PjeTrt18AngularWaits.aguardarUrl(page, PjeTrt18AngularWaits.URL_KEYCLOAK_GLOB, browserProperties.getTimeoutMs());
            resolverPaginaAtiva();
            PjeBrowserPreconditions.selecionarMetodoUsuarioSenhaSeNecessario(page);
            log.info("PJe: abriu URL (grau={}, headless={})", grau, browserProperties.isHeadless());
        });
    }

    boolean tentarRestaurarSessao(PjeGrau grau, String login) {
        if (grau == null || login == null || login.isBlank() || !storageStateStore.existe(grau, login)) {
            return false;
        }
        fechar();
        this.grauAtual = grau;
        this.loginAtual = login.trim();
        artifacts.iniciarTentativa();
        artifacts.associarLogin(loginAtual);
        Path state = storageStateStore.caminho(grau, loginAtual);
        iniciarBrowser(state);

        try {
            page.navigate(trt18Properties.urlPainelPosLogin(grau));
            aguardarPainelPosLogin();
            log.info("PJe: sessão restaurada via storageState");
            return true;
        } catch (RuntimeException e) {
            log.info("PJe: storageState expirado ou inválido — login completo necessário");
            fechar();
            return false;
        }
    }

    void preencherCredenciais(String login, String senha) {
        if (loginAtual != null && sessaoAutenticada()) {
            return;
        }
        artifacts.associarLogin(login);
        this.loginAtual = login.trim();
        executarPasso("preencher-credenciais", () -> {
            garantirPagina();
            PjeBrowserPreconditions.selecionarMetodoUsuarioSenhaSeNecessario(page);
            aguardarCamposKeycloak();
            PjeTrt18Locators.campoUsuario(page).fill(login);
            PjeTrt18Locators.campoSenha(page).fill(senha);
        });
    }

    void submeterLogin() {
        executarPasso("submeter-login", () -> {
            garantirPagina();
            PjeTrt18Locators.botaoKeycloakLogin(page).click();
            PjeBrowserWaits.aguardarPosNavegacao(
                    page, browserProperties.getTimeoutMs(), browserProperties.getJsfSettleMs());
            resolverPaginaAtiva();
            PjeBrowserPreconditions.validarPosCredencial(page);
            log.info("PJe: 1º fator submetido");
        });
    }

    boolean telaOtpVisivel() {
        if (page == null || page.isClosed()) {
            return false;
        }
        try {
            PjeBrowserWaits.aguardarPosNavegacao(
                    page, browserProperties.getTimeoutMs(), browserProperties.getJsfSettleMs());
            PjeBrowserPreconditions.validarPosCredencial(page);
            PjeTrt18Locators.campoOtp(page)
                    .waitFor(new com.microsoft.playwright.Locator.WaitForOptions()
                            .setState(WaitForSelectorState.VISIBLE)
                            .setTimeout(browserProperties.getTimeoutMs()));
            log.info("PJe: campo OTP detectado");
            return true;
        } catch (PjeBrowserPreconditionException e) {
            registrarFalhaPasso("tela-otp-precondicao");
            throw e;
        } catch (RuntimeException e) {
            return false;
        }
    }

    void preencherCodigoOtp(String codigo) {
        executarPasso("preencher-otp", () -> {
            garantirPagina();
            if (codigo == null || codigo.length() != 6) {
                throw new IllegalArgumentException("Código OTP deve ter 6 dígitos.");
            }
            PjeTrt18Locators.campoOtp(page).fill(codigo);
        });
    }

    void submeterOtp() {
        executarPasso("submeter-otp", () -> {
            garantirPagina();
            PjeTrt18Locators.botaoKeycloakLogin(page).click();
            aguardarPainelPosLogin();
            log.info("PJe: OTP submetido");
            log.info("PJe: pós-login OK");
            if (loginAtual != null) {
                storageStateStore.salvar(context, grauAtual, loginAtual);
            }
        });
    }

    void aguardarPainelPosLogin() {
        PjeTrt18AngularWaits.aguardarUrl(page, PjeTrt18AngularWaits.URL_PAINEL_GLOB, browserProperties.getTimeoutMs());
        resolverPaginaAtiva();
        aguardarCampoBuscaProcessoVisivel();
    }

    private void aguardarCampoBuscaProcessoVisivel() {
        PjeTrt18Locators.campoBuscaProcesso(page)
                .waitFor(new com.microsoft.playwright.Locator.WaitForOptions()
                        .setState(WaitForSelectorState.VISIBLE)
                        .setTimeout(browserProperties.getTimeoutMs()));
        log.info("PJe: campo busca processo disponível no painel");
    }

    void buscarProcessoPorCnj(String numeroCnj) {
        executarPasso("buscar-processo", () -> {
            garantirPagina();
            if (!sessaoAutenticada()) {
                throw new IllegalStateException("Sessão PJe não autenticada; execute login antes da busca.");
            }
            if (trt18Properties.isModoLeitura()) {
                log.debug("PJe: modo leitura — apenas busca/navegação");
            }
            var campo = PjeTrt18Locators.campoBuscaProcesso(page);
            if (!campo.isVisible()) {
                aguardarCampoBuscaProcessoVisivel();
            }
            campo.fill(numeroCnj);
            campo.press("Enter");
            PjeTrt18AngularWaits.aguardarAcervoComCnj(page, numeroCnj, browserProperties.getTimeoutMs());
            log.info("PJe: processo localizado no acervo-geral");
        });
    }

    byte[] baixarCopiaIntegralPdf(String numeroCnj) {
        return executarPassoComRetorno("copia-integral", () -> {
            garantirPagina();
            var botaoDetalhes = PjeTrt18Locators.botaoDetalhesProcesso(
                    page, trt18Properties.getCopiaIntegralButtonSelector());
            return PjeCopiaIntegralDownloader.baixarComRetry(context, page, botaoDetalhes, trt18Properties);
        });
    }

    PjeBrowserSessionState estadoAtual() {
        if (page == null || page.isClosed()) {
            return PjeBrowserSessionState.NAO_ABERTO;
        }
        if (otpCampoVisivelSemPrecondicao()) {
            return PjeBrowserSessionState.TELA_OTP;
        }
        if (sessaoAutenticada()) {
            return PjeBrowserSessionState.AUTENTICADO;
        }
        if (camposLoginPresentes()) {
            return PjeBrowserSessionState.TELA_LOGIN;
        }
        return PjeBrowserSessionState.ERRO;
    }

    void fechar() {
        boolean pausarHeaded = artifacts.houveFalha() && !browserProperties.isHeadless();
        artifacts.finalizar(context, pausarHeaded);
        encerrarRecursos();
    }

    private void iniciarBrowser(Path storageStatePath) {
        try {
            Files.createDirectories(browserProperties.downloadDirPath());
        } catch (Exception e) {
            throw new IllegalStateException("Não foi possível criar diretório de download PJe: " + e.getMessage(), e);
        }

        playwright = Playwright.create();
        BrowserType.LaunchOptions launchOpts = new BrowserType.LaunchOptions()
                .setHeadless(browserProperties.isHeadless())
                .setArgs(java.util.List.of("--no-sandbox", "--disable-dev-shm-usage"));
        if (StringUtils.hasText(browserProperties.getProxy())) {
            String proxyServer = browserProperties.getProxy().trim();
            launchOpts.setProxy(new Proxy(proxyServer));
            log.info("PJe Playwright: proxy de saída configurado ({})", mascaraProxy(proxyServer));
        }
        browser = playwright.chromium().launch(launchOpts);
                        
        Browser.NewContextOptions opts = new Browser.NewContextOptions()
                .setUserAgent(USER_AGENT)
                .setAcceptDownloads(true);
        if (storageStatePath != null) {
            opts.setStorageStatePath(storageStatePath);
        }
        context = browser.newContext(opts);
        artifacts.iniciarTracing(context);
        page = context.newPage();
        aplicarTimeoutsPagina(page);
    }

    private void aplicarTimeoutsPagina(Page pagina) {
        int locatorTimeout = browserProperties.timeoutEfetivoMs();
        int navigationTimeout = browserProperties.navigationTimeoutEfetivoMs();
        pagina.setDefaultTimeout(locatorTimeout);
        pagina.setDefaultNavigationTimeout(navigationTimeout);
        if (navigationTimeout > locatorTimeout && StringUtils.hasText(browserProperties.getProxy())) {
            log.info(
                    "PJe Playwright: navigationTimeout={}ms (locators={}ms, proxy ativo)",
                    navigationTimeout,
                    locatorTimeout);
        }
    }

    private boolean sessaoAutenticada() {
        return PjeTrt18Locators.urlPainelAutenticado(page.url())
                || page.url().contains("/acervo-geral/");
    }

    private boolean otpCampoVisivelSemPrecondicao() {
        try {
            return PjeTrt18Locators.campoOtp(page).isVisible();
        } catch (RuntimeException e) {
            return false;
        }
    }

    private boolean camposLoginPresentes() {
        try {
            return PjeTrt18Locators.campoUsuario(page).isVisible()
                    && PjeTrt18Locators.campoSenha(page).isVisible();
        } catch (RuntimeException e) {
            return false;
        }
    }

    private void aguardarCamposKeycloak() {
        int timeout = browserProperties.getTimeoutMs();
        PjeTrt18Locators.campoUsuario(page)
                .waitFor(new com.microsoft.playwright.Locator.WaitForOptions()
                        .setState(WaitForSelectorState.VISIBLE)
                        .setTimeout(timeout));
        PjeTrt18Locators.campoSenha(page)
                .waitFor(new com.microsoft.playwright.Locator.WaitForOptions()
                        .setState(WaitForSelectorState.VISIBLE)
                        .setTimeout(timeout));
    }

    private void resolverPaginaAtiva() {
        if (context == null) {
            return;
        }
        var pages = context.pages();
        if (!pages.isEmpty()) {
            page = pages.get(pages.size() - 1);
            aplicarTimeoutsPagina(page);
        }
    }

    private void garantirPagina() {
        if (page == null || page.isClosed()) {
            throw new IllegalStateException("Sessão Playwright PJe não aberta.");
        }
    }

    private void executarPasso(String etapa, Runnable acao) {
        try {
            acao.run();
        } catch (RuntimeException e) {
            registrarFalhaPasso(etapa);
            throw e;
        }
    }

    private <T> T executarPassoComRetorno(String etapa, java.util.function.Supplier<T> acao) {
        try {
            return acao.get();
        } catch (RuntimeException e) {
            registrarFalhaPasso(etapa);
            throw e;
        }
    }

    private void registrarFalhaPasso(String etapa) {
        artifacts.registrarFalha(page, etapa);
    }

    private void encerrarRecursos() {
        if (page != null) {
            try {
                page.close();
            } catch (RuntimeException ignored) {
                // noop
            }
            page = null;
        }
        if (context != null) {
            try {
                context.close();
            } catch (RuntimeException ignored) {
                // noop
            }
            context = null;
        }
        if (browser != null) {
            try {
                browser.close();
            } catch (RuntimeException ignored) {
                // noop
            }
            browser = null;
        }
        if (playwright != null) {
            try {
                playwright.close();
            } catch (RuntimeException ignored) {
                // noop
            }
            playwright = null;
        }
        grauAtual = null;
        loginAtual = null;
    }

    private static String mascaraProxy(String proxyServer) {
        if (!StringUtils.hasText(proxyServer)) {
            return "(vazio)";
        }
        int at = proxyServer.lastIndexOf('@');
        String hostPort = at >= 0 ? proxyServer.substring(at + 1) : proxyServer;
        int scheme = hostPort.indexOf("://");
        if (scheme >= 0) {
            return proxyServer.substring(0, scheme + 3) + hostPort.substring(scheme + 3);
        }
        return hostPort;
    }
}
