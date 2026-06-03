package br.com.vilareal.integracao.cora;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;

import javax.net.ssl.SSLContext;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Cliente HTTP com mTLS para chamadas à API Cora (token e recursos autenticados).
 */
public class CoraMtlsHttpClient {

    private static final Logger log = LoggerFactory.getLogger(CoraMtlsHttpClient.class);

    private final HttpClient httpClient;

    public CoraMtlsHttpClient(SSLContext sslContext) {
        this.httpClient = HttpClient.newBuilder()
                .sslContext(sslContext)
                .connectTimeout(Duration.ofSeconds(30))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public CoraHttpResponse get(String url, Map<String, String> headers) {
        return send("GET", url, headers, null, null);
    }

    public CoraHttpResponse postForm(String url, Map<String, String> headers, String formBody) {
        Map<String, String> h = new LinkedHashMap<>(headers != null ? headers : Map.of());
        h.putIfAbsent("Content-Type", "application/x-www-form-urlencoded");
        return send("POST", url, h, formBody, null);
    }

    public CoraHttpResponse postJson(String url, Map<String, String> headers, String jsonBody) {
        Map<String, String> h = new LinkedHashMap<>(headers != null ? headers : Map.of());
        h.putIfAbsent("Content-Type", "application/json");
        return send("POST", url, h, jsonBody, null);
    }

    private CoraHttpResponse send(
            String method, String url, Map<String, String> headers, String body, String idempotencyKey) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(60));
            headers.forEach(builder::header);
            if ("POST".equals(method)) {
                builder.POST(HttpRequest.BodyPublishers.ofString(body != null ? body : ""));
            } else {
                builder.GET();
            }
            HttpRequest request = builder.build();

            log.debug("[Cora] HTTP {} {}", method, url);
            if (StringUtils.hasText(idempotencyKey)) {
                log.debug("[Cora] Idempotency-Key: {}", idempotencyKey);
            }

            HttpResponse<String> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            Map<String, String> responseHeaders = response.headers().map().entrySet().stream()
                    .collect(Collectors.toMap(
                            Map.Entry::getKey,
                            e -> String.join(", ", e.getValue()),
                            (a, b) -> a,
                            LinkedHashMap::new));

            String responseBody = response.body() != null ? response.body() : "";
            if (response.statusCode() == 401 || response.statusCode() == 403) {
                log.warn("[Cora] Possível falha de autenticação/mTLS (status {}).", response.statusCode());
            }

            return new CoraHttpResponse(response.statusCode(), responseBody, responseHeaders);
        } catch (javax.net.ssl.SSLHandshakeException e) {
            log.error("[Cora] FALHA no handshake mTLS ao chamar {}: {}", url, e.getMessage());
            throw new IllegalStateException("Handshake mTLS falhou: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("[Cora] Erro HTTP {} {}: {}", method, url, e.getMessage());
            throw new IllegalStateException("Erro na requisição Cora: " + e.getMessage(), e);
        }
    }
}
