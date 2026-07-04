package br.com.vilareal.whatsapp.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

/**
 * Mantém arquivos temporários de mídia outbound até o Passo 2 (Drive async) consumir e apagar.
 *
 * <p>Fluxo: após envio síncrono à Meta, {@link #stageForDriveUpload} move o temp para
 * {@code java.io.tmpdir/whatsapp-outbound-staging/{messageId}_*}; o Passo 2 chama
 * {@link #takeStagedFile(long)} + upload Drive + {@link #deleteStaged(long)}.
 */
@Service
public class WhatsAppOutboundMediaStagingService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppOutboundMediaStagingService.class);
    static final String STAGING_DIR_NAME = "whatsapp-outbound-staging";

    private final Path defaultStagingDir;

    public WhatsAppOutboundMediaStagingService() {
        this.defaultStagingDir = Path.of(System.getProperty("java.io.tmpdir"), STAGING_DIR_NAME);
    }

    Path getStagingDir() {
        return defaultStagingDir;
    }

    /**
     * Move o arquivo temporário do upload HTTP para staging gerenciado (sobrevive ao fim do request).
     */
    public Path stageForDriveUpload(long messageId, Path tempFile) throws IOException {
        Path dir = getStagingDir();
        Files.createDirectories(dir);
        String suffix = tempFile.getFileName() != null ? tempFile.getFileName().toString() : "media";
        Path dest = dir.resolve(messageId + "_" + sanitize(suffix));
        Files.move(tempFile, dest, StandardCopyOption.REPLACE_EXISTING);
        log.debug("Mídia outbound staged para Drive: messageId={}, path={}", messageId, dest);
        return dest;
    }

    /** Passo 2: obtém o arquivo staged (se existir). */
    public Optional<Path> takeStagedFile(long messageId) {
        try {
            Path dir = getStagingDir();
            if (!Files.isDirectory(dir)) {
                return Optional.empty();
            }
            try (Stream<Path> paths = Files.list(dir)) {
                return paths
                        .filter(p -> p.getFileName().toString().startsWith(messageId + "_"))
                        .findFirst();
            }
        } catch (IOException e) {
            log.warn("Falha ao localizar staged outbound messageId={}: {}", messageId, e.getMessage());
            return Optional.empty();
        }
    }

    /** Passo 2: remove arquivo staged após upload Drive. */
    public void deleteStaged(long messageId) {
        takeStagedFile(messageId).ifPresent(path -> {
            try {
                Files.deleteIfExists(path);
                log.debug("Staged outbound removido: messageId={}", messageId);
            } catch (IOException e) {
                log.warn("Falha ao remover staged outbound messageId={}: {}", messageId, e.getMessage());
            }
        });
    }

    /** Remove temp/staged quando o envio falhou antes do Drive (sem linha persistida). */
    public void deleteQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            log.warn("Falha ao remover temp outbound {}: {}", path, e.getMessage());
        }
    }

    /**
     * Apaga arquivos no staging mais antigos que {@code maxAge} (órfãos após crash ou async abandonado).
     *
     * @return quantidade de arquivos removidos
     */
    public int limparOrfaosAntigos(Duration maxAge) {
        if (maxAge == null || maxAge.isNegative() || maxAge.isZero()) {
            return 0;
        }
        Path dir = getStagingDir();
        if (!Files.isDirectory(dir)) {
            return 0;
        }

        Instant limite = Instant.now().minus(maxAge);
        AtomicInteger removidos = new AtomicInteger();

        try (Stream<Path> paths = Files.list(dir)) {
            paths.filter(Files::isRegularFile).forEach(path -> {
                try {
                    FileTime modified = Files.getLastModifiedTime(path);
                    if (modified.toInstant().isBefore(limite)) {
                        if (Files.deleteIfExists(path)) {
                            removidos.incrementAndGet();
                            log.debug("Staging outbound órfão removido: {}", path.getFileName());
                        }
                    }
                } catch (IOException e) {
                    log.warn("Falha ao avaliar/remover órfão {}: {}", path, e.getMessage());
                }
            });
        } catch (IOException e) {
            log.warn("Falha ao varrer staging outbound: {}", e.getMessage());
        }

        if (removidos.get() > 0) {
            log.info("Staging outbound: {} arquivo(s) órfão(s) removido(s)", removidos.get());
        }
        return removidos.get();
    }

    private static String sanitize(String name) {
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
