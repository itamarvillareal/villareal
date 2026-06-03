package br.com.vilareal.integracao.cora.sandbox;

import br.com.vilareal.integracao.cora.CoraHttpResponse;
import br.com.vilareal.integracao.cora.CoraMtlsHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Decorador do {@link CoraMtlsHttpClient} com log de laboratório e suporte a Idempotency-Key.
 */
class CoraSandboxHttpClient {

    private static final Logger log = LoggerFactory.getLogger(CoraSandboxHttpClient.class);

    private final CoraMtlsHttpClient delegate;
    private final CoraSandboxLogWriter logWriter;

    CoraSandboxHttpClient(CoraMtlsHttpClient delegate, CoraSandboxLogWriter logWriter) {
        this.delegate = delegate;
        this.logWriter = logWriter;
    }

    CoraHttpResponse get(String url, Map<String, String> headers) {
        log.info("[CoraSandbox] HTTP GET {}", url);
        logWriter.write("REQUEST GET " + url);
        CoraHttpResponse response = delegate.get(url, headers != null ? headers : Map.of());
        logResponse("GET", url, response);
        return response;
    }

    CoraHttpResponse postForm(String url, Map<String, String> headers, String formBody) {
        log.info("[CoraSandbox] HTTP POST {}", url);
        logWriter.write("REQUEST POST " + url + "\n" + (formBody != null ? formBody : ""));
        CoraHttpResponse response = delegate.postForm(url, headers != null ? headers : Map.of(), formBody);
        logResponse("POST", url, response);
        return response;
    }

    CoraHttpResponse postJson(String url, Map<String, String> headers, String jsonBody, String idempotencyKey) {
        Map<String, String> h = new LinkedHashMap<>(headers != null ? headers : Map.of());
        if (StringUtils.hasText(idempotencyKey)) {
            h.put("Idempotency-Key", idempotencyKey);
            log.info("[CoraSandbox] Idempotency-Key: {}", idempotencyKey);
        }
        log.info("[CoraSandbox] HTTP POST {}", url);
        logWriter.write("REQUEST POST " + url + "\n" + (jsonBody != null ? jsonBody : ""));
        CoraHttpResponse response = delegate.postJson(url, h, jsonBody);
        logResponse("POST", url, response);
        return response;
    }

    private void logResponse(String method, String url, CoraHttpResponse response) {
        log.info("[CoraSandbox] HTTP {} {} → status {}", method, url, response.statusCode());
        logWriter.write("RESPONSE status=" + response.statusCode() + "\n" + response.body());
    }
}
