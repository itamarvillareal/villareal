package br.com.vilareal.pje.infrastructure.browser;

import br.com.vilareal.pje.config.PjeBrowserProperties;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Tracing;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Tracing Playwright + screenshot/HTML em falhas (sem expor credenciais).
 */
final class PjeBrowserArtifacts {

    private static final Logger log = LoggerFactory.getLogger(PjeBrowserArtifacts.class);

    private static final DateTimeFormatter TS =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);

    private final PjeBrowserProperties properties;
    private final Path traceDir;
    private String tentativaId;
    private boolean tracingAtivo;
    private boolean falhaRegistrada;

    PjeBrowserArtifacts(PjeBrowserProperties properties) {
        this.properties = properties;
        this.traceDir = properties.traceDirPath();
    }

    void iniciarTentativa() {
        this.tentativaId = TS.format(Instant.now()) + "-pre";
        this.falhaRegistrada = false;
        try {
            Files.createDirectories(traceDir);
        } catch (Exception e) {
            throw new IllegalStateException("Não foi possível criar trace-dir PJe: " + e.getMessage(), e);
        }
    }

    void associarLogin(String login) {
        if (tentativaId == null) {
            iniciarTentativa();
        }
        String ts = tentativaId.startsWith("20") ? tentativaId.substring(0, 16) : TS.format(Instant.now());
        this.tentativaId = ts + "-" + PjeBrowserLoginHash.hash8(login);
    }

    void iniciarTracing(BrowserContext context) {
        if (context == null) {
            return;
        }
        try {
            context.tracing()
                    .start(new Tracing.StartOptions()
                            .setScreenshots(true)
                            .setSnapshots(true)
                            .setSources(true));
            tracingAtivo = true;
        } catch (RuntimeException e) {
            log.warn("PJe trace: não foi possível iniciar tracing: {}", e.getMessage());
            tracingAtivo = false;
        }
    }

    void registrarFalha(Page page, String etapa) {
        if (page == null || page.isClosed()) {
            return;
        }
        falhaRegistrada = true;
        String base = (tentativaId != null ? tentativaId : TS.format(Instant.now()) + "-anon") + "-" + etapa;
        try {
            Path png = traceDir.resolve(base + "-failure.png");
            page.screenshot(new Page.ScreenshotOptions().setPath(png).setFullPage(true));
            Path html = traceDir.resolve(base + "-failure.html");
            Files.writeString(html, page.content());
            log.info("PJe artefatos de falha salvos: {} e {} (etapa={})", png.getFileName(), html.getFileName(), etapa);
        } catch (Exception e) {
            log.warn("PJe artefatos de falha não salvos (etapa={}): {}", etapa, e.getMessage());
        }
    }

    void finalizar(BrowserContext context, boolean pausarHeaded) {
        if (pausarHeaded && falhaRegistrada && !properties.isHeadless()) {
            int pause = properties.getHeadedFailurePauseMs();
            log.info("PJe headed: pausa {}ms antes de fechar o browser (inspecione a janela)", pause);
            try {
                Thread.sleep(pause);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        pararTracing(context);
        falhaRegistrada = false;
    }

    private void pararTracing(BrowserContext context) {
        if (context == null || !tracingAtivo) {
            return;
        }
        String id = tentativaId != null ? tentativaId : TS.format(Instant.now()) + "-anon";
        Path zip = traceDir.resolve(id + "-trace.zip");
        try {
            context.tracing().stop(new Tracing.StopOptions().setPath(zip));
            log.info("PJe trace salvo: {}", zip);
        } catch (RuntimeException e) {
            log.warn("PJe trace não salvo: {}", e.getMessage());
        } finally {
            tracingAtivo = false;
        }
    }

    boolean houveFalha() {
        return falhaRegistrada;
    }
}
