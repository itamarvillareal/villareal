package br.com.vilareal.pje.infrastructure.browser;

import br.com.vilareal.pje.config.PjeBrowserProperties;
import br.com.vilareal.pje.domain.PjeGrau;
import com.microsoft.playwright.BrowserContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class PjeTrt18StorageStateStore {

    private static final Logger log = LoggerFactory.getLogger(PjeTrt18StorageStateStore.class);

    private final PjeBrowserProperties browserProperties;

    PjeTrt18StorageStateStore(PjeBrowserProperties browserProperties) {
        this.browserProperties = browserProperties;
    }

    Path caminho(PjeGrau grau, String login) {
        String grauTag = grau != null ? grau.name().toLowerCase() : "grau";
        return browserProperties.storageStateDirPath()
                .resolve(grauTag + "-" + PjeBrowserLoginHash.hash8(login) + ".json");
    }

    boolean existe(PjeGrau grau, String login) {
        return Files.isRegularFile(caminho(grau, login));
    }

    void salvar(BrowserContext context, PjeGrau grau, String login) {
        if (context == null || grau == null || login == null || login.isBlank()) {
            return;
        }
        try {
            Files.createDirectories(browserProperties.storageStateDirPath());
            Path destino = caminho(grau, login);
            context.storageState(new BrowserContext.StorageStateOptions().setPath(destino));
            log.info("PJe: storageState salvo ({})", destino.getFileName());
        } catch (Exception e) {
            log.warn("PJe: falha ao salvar storageState: {}", e.getMessage());
        }
    }
}
