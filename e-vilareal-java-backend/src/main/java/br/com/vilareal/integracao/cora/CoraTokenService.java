package br.com.vilareal.integracao.cora;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Obtém e renova access_token (client_credentials + mTLS). Cache em memória (~24h).
 */
public class CoraTokenService {

    private static final Logger log = LoggerFactory.getLogger(CoraTokenService.class);

    private final CoraTokenSettings settings;
    private final CoraMtlsHttpClient httpClient;
    private final ObjectMapper objectMapper;

    private final ReentrantLock lock = new ReentrantLock();
    private volatile String accessToken;
    private volatile Instant expiresAt = Instant.EPOCH;

    public CoraTokenService(CoraTokenSettings settings, CoraMtlsHttpClient httpClient, ObjectMapper objectMapper) {
        this.settings = settings;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    public String getToken() {
        if (isTokenValid()) {
            return accessToken;
        }
        lock.lock();
        try {
            if (isTokenValid()) {
                return accessToken;
            }
            fetchToken();
            return accessToken;
        } finally {
            lock.unlock();
        }
    }

    public Map<String, String> authHeaders() {
        return Map.of("Authorization", "Bearer " + getToken());
    }

    /** Força handshake mTLS + token (smoke test / laboratório). */
    public boolean verifyMtlsAndAuth() {
        try {
            getToken();
            log.info("[Cora] mTLS + autenticação OK (token obtido).");
            return true;
        } catch (Exception e) {
            log.error("[Cora] mTLS/autenticação FALHOU: {}", e.getMessage());
            return false;
        }
    }

    /** Expõe validade para testes (não força refresh). */
    boolean isTokenValidForTest() {
        return isTokenValid();
    }

    Instant expiresAtForTest() {
        return expiresAt;
    }

    void setCachedTokenForTest(String token, Instant expiresAt) {
        this.accessToken = token;
        this.expiresAt = expiresAt;
    }

    private boolean isTokenValid() {
        if (!StringUtils.hasText(accessToken)) {
            return false;
        }
        Instant skew = Instant.now().plusSeconds(settings.getTokenRefreshSkewSeconds());
        return expiresAt.isAfter(skew);
    }

    private void fetchToken() {
        if (!StringUtils.hasText(settings.getClientId())) {
            throw new IllegalStateException("CORA_CLIENT_ID não configurado.");
        }
        String url = stripTrailingSlash(settings.getTokenBaseUrl()) + "/token";
        String form = "grant_type=client_credentials&client_id=" + urlEncode(settings.getClientId());

        log.info("[Cora] Solicitando token em {}.", url);
        CoraHttpResponse response = httpClient.postForm(url, Map.of(), form);

        if (!response.isSuccess()) {
            throw new IllegalStateException(
                    "Falha ao obter token Cora (HTTP " + response.statusCode() + "): " + response.body());
        }

        try {
            JsonNode json = objectMapper.readTree(response.body());
            this.accessToken = json.path("access_token").asText(null);
            int expiresIn = json.path("expires_in").asInt(86400);
            this.expiresAt = Instant.now().plusSeconds(expiresIn);
            if (!StringUtils.hasText(accessToken)) {
                throw new IllegalStateException("Resposta de token sem access_token: " + response.body());
            }
            log.info(
                    "[Cora] Token obtido: {}... (expira em ~{}s, válido até {})",
                    maskToken(accessToken),
                    expiresIn,
                    expiresAt);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Erro ao parsear token Cora: " + e.getMessage(), e);
        }
    }

    private static String stripTrailingSlash(String url) {
        return url != null && url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private static String urlEncode(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }

    public static String maskToken(String token) {
        if (token == null || token.length() < 12) {
            return "****";
        }
        return token.substring(0, 8) + "..." + token.substring(token.length() - 4);
    }
}
