package br.com.vilareal.integracao.cora;

import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.Map;

/**
 * Cliente fino para requisições autenticadas à API Cora (mTLS + Bearer).
 * Idempotency-Key fica nas etapas de boleto/pagamento (3b).
 */
public class CoraClient {

    private final CoraProperties props;
    private final CoraMtlsHttpClient httpClient;
    private final CoraTokenService tokenService;

    public CoraClient(CoraProperties props, CoraMtlsHttpClient httpClient, CoraTokenService tokenService) {
        this.props = props;
        this.httpClient = httpClient;
        this.tokenService = tokenService;
    }

    public CoraHttpResponse get(String path, Map<String, String> extraHeaders) {
        return httpClient.get(absoluteUrl(path), mergeAuthHeaders(extraHeaders));
    }

    public CoraHttpResponse get(String path) {
        return get(path, Map.of());
    }

    public CoraHttpResponse postJson(String path, String jsonBody, Map<String, String> extraHeaders) {
        return httpClient.postJson(absoluteUrl(path), mergeAuthHeaders(extraHeaders), jsonBody);
    }

    public CoraHttpResponse postJson(String path, String jsonBody) {
        return postJson(path, jsonBody, Map.of());
    }

    private Map<String, String> mergeAuthHeaders(Map<String, String> extraHeaders) {
        Map<String, String> headers = new HashMap<>(tokenService.authHeaders());
        if (extraHeaders != null) {
            extraHeaders.forEach((k, v) -> {
                if (StringUtils.hasText(k) && v != null) {
                    headers.put(k, v);
                }
            });
        }
        return headers;
    }

    private String absoluteUrl(String path) {
        String base = stripTrailingSlash(props.getBaseUrl());
        if (!StringUtils.hasText(path)) {
            return base;
        }
        return path.startsWith("/") ? base + path : base + "/" + path;
    }

    private static String stripTrailingSlash(String url) {
        return url != null && url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
