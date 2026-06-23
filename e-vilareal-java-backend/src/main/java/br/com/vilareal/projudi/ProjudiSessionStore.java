package br.com.vilareal.projudi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.HttpCookie;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Persistência local de cookies de sessão PROJUDI por credencial (padrão similar ao token store Gmail). */
@Component
class ProjudiSessionStore {

    private static final Logger log = LoggerFactory.getLogger(ProjudiSessionStore.class);

    private final ObjectMapper objectMapper;
    private final Path storeDir;

    ProjudiSessionStore(
            ObjectMapper objectMapper,
            @Value("${projudi.session.store-dir:}") String storeDirConfig) {
        this.objectMapper = objectMapper;
        this.storeDir = StringUtils.hasText(storeDirConfig) ? Path.of(storeDirConfig.trim()) : null;
    }

    boolean isAtivo() {
        return storeDir != null;
    }

    Optional<SessaoPersistida> carregar(Long credencialId) {
        if (!isAtivo() || credencialId == null) {
            return Optional.empty();
        }
        Path arquivo = arquivoCredencial(credencialId);
        if (!Files.isRegularFile(arquivo)) {
            return Optional.empty();
        }
        try {
            SessaoPersistida data = objectMapper.readValue(arquivo.toFile(), SessaoPersistida.class);
            if (data == null || data.cookies() == null || data.cookies().isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(data);
        } catch (Exception e) {
            log.warn("Falha ao ler sessão PROJUDI persistida (credencialId={}): {}", credencialId, e.getMessage());
            return Optional.empty();
        }
    }

    void salvar(Long credencialId, ProjudiSessionService.ProjudiSession sessao) {
        if (!isAtivo() || credencialId == null || sessao == null || sessao.cookieManager() == null) {
            return;
        }
        try {
            Files.createDirectories(storeDir);
            protegerDiretorio(storeDir);

            List<CookieSnapshot> snapshots = new ArrayList<>();
            for (HttpCookie cookie : sessao.cookieManager().getCookieStore().getCookies()) {
                snapshots.add(CookieSnapshot.from(cookie));
            }
            SessaoPersistida data = new SessaoPersistida(sessao.autenticadoEm(), sessao.ultimaAtividadeEm(), snapshots);
            Path arquivo = arquivoCredencial(credencialId);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(arquivo.toFile(), data);
            protegerArquivo(arquivo);
        } catch (Exception e) {
            log.warn("Falha ao persistir sessão PROJUDI (credencialId={}): {}", credencialId, e.getMessage());
        }
    }

    void apagar(Long credencialId) {
        if (!isAtivo() || credencialId == null) {
            return;
        }
        try {
            Files.deleteIfExists(arquivoCredencial(credencialId));
        } catch (IOException e) {
            log.warn("Falha ao apagar sessão PROJUDI persistida (credencialId={}): {}", credencialId, e.getMessage());
        }
    }

    private Path arquivoCredencial(Long credencialId) {
        return storeDir.resolve("session-" + credencialId + ".json");
    }

    private static void protegerDiretorio(Path dir) {
        try {
            Set<PosixFilePermission> perms = PosixFilePermissions.fromString("rwx------");
            Files.setPosixFilePermissions(dir, perms);
        } catch (Exception ignored) {
            // Windows ou FS sem POSIX — ignora
        }
    }

    private static void protegerArquivo(Path arquivo) {
        try {
            Set<PosixFilePermission> perms = PosixFilePermissions.fromString("rw-------");
            Files.setPosixFilePermissions(arquivo, perms);
        } catch (Exception ignored) {
            // Windows ou FS sem POSIX — ignora
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record SessaoPersistida(Instant autenticadoEm, Instant ultimaAtividadeEm, List<CookieSnapshot> cookies) {}

    record CookieSnapshot(
            String name,
            String value,
            String comment,
            String commentURL,
            String domain,
            String path,
            long maxAge,
            boolean secure,
            int version,
            boolean discard) {

        static CookieSnapshot from(HttpCookie cookie) {
            return new CookieSnapshot(
                    cookie.getName(),
                    cookie.getValue(),
                    cookie.getComment(),
                    cookie.getCommentURL(),
                    cookie.getDomain(),
                    cookie.getPath(),
                    cookie.getMaxAge(),
                    cookie.getSecure(),
                    cookie.getVersion(),
                    cookie.getDiscard());
        }

        HttpCookie toHttpCookie() {
            HttpCookie cookie = new HttpCookie(name, value);
            if (comment != null) {
                cookie.setComment(comment);
            }
            if (commentURL != null) {
                cookie.setCommentURL(commentURL);
            }
            if (domain != null) {
                cookie.setDomain(domain);
            }
            if (path != null) {
                cookie.setPath(path);
            }
            cookie.setMaxAge(maxAge);
            cookie.setSecure(secure);
            cookie.setVersion(version);
            cookie.setDiscard(discard);
            return cookie;
        }
    }
}
