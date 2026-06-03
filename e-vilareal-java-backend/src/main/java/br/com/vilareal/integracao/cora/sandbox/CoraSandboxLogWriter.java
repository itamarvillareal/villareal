package br.com.vilareal.integracao.cora.sandbox;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;

/**
 * Log dedicado do laboratório Cora (console + arquivo opcional).
 */
class CoraSandboxLogWriter {

    private static final Logger log = LoggerFactory.getLogger(CoraSandboxLogWriter.class);

    private final Path logFile;

    CoraSandboxLogWriter(CoraSandboxProperties props) {
        if (StringUtils.hasText(props.getLogFile())) {
            this.logFile = Path.of(props.getLogFile());
        } else {
            this.logFile = null;
        }
    }

    void write(String message) {
        String line = Instant.now() + " " + message;
        log.debug("[CoraSandbox-file] {}", message);
        if (logFile == null) {
            return;
        }
        try {
            Files.createDirectories(logFile.getParent() != null ? logFile.getParent() : Path.of("."));
            Files.writeString(
                    logFile,
                    line + System.lineSeparator(),
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND);
        } catch (IOException e) {
            log.warn("[CoraSandbox] Não foi possível gravar log em {}: {}", logFile, e.getMessage());
        }
    }
}
