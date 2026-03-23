package br.com.vilareal.api.monitoring.datajud;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Cliente HTTP para API pública DataJud (Elasticsearch). Autenticação API Key.
 */
@Component
public class DatajudPublicApiClient {

    private static final Logger log = LoggerFactory.getLogger(DatajudPublicApiClient.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final int timeoutMs;

    public DatajudPublicApiClient(
            @Value("${vilareal.datajud.base-url:https://api-publica.datajud.cnj.jus.br}") String baseUrl,
            @Value("${vilareal.datajud.api-key:}") String apiKey,
            @Value("${vilareal.monitoring.request-timeout-ms:28000}") int timeoutMs,
            ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.timeoutMs = timeoutMs;
        RestClient.Builder b = RestClient.builder()
                .baseUrl(baseUrl.replaceAll("/$", ""))
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
        if (apiKey != null && !apiKey.isBlank()) {
            b.defaultHeader(HttpHeaders.AUTHORIZATION, "APIKey " + apiKey.trim());
        }
        this.restClient = b.build();
    }

    public Map<String, Object> buildProcessNumberQuery(String numeroCnjNormalizado, int size) {
        Map<String, Object> query = new LinkedHashMap<>();
        query.put("size", size);
        Map<String, Object> bool = new LinkedHashMap<>();
        List<Map<String, Object>> should = List.of(
                Map.of("match", Map.of("numeroProcesso", numeroCnjNormalizado)),
                Map.of("term", Map.of("numeroProcesso.keyword", numeroCnjNormalizado))
        );
        bool.put("should", should);
        bool.put("minimum_should_match", 1);
        query.put("query", Map.of("bool", bool));
        return query;
    }

    /** Busca genérica por texto (muitos índices não suportam ou retornam vazio — uso com cautela). */
    public Map<String, Object> buildFuzzyPartyQuery(String texto, int size) {
        Map<String, Object> query = new LinkedHashMap<>();
        query.put("size", size);
        query.put("query", Map.of("simple_query_string", Map.of(
                "query", texto,
                "fields", List.of("nomeParte", "partes.nome", "polo.ativo.nome", "polo.passivo.nome"),
                "default_operator", "and"
        )));
        return query;
    }

    public DatajudSearchResult search(String apiIndex, Map<String, Object> body) {
        if (apiIndex == null || apiIndex.isBlank()) {
            return DatajudSearchResult.failure("tribunal_sem_indice", 0, null);
        }
        String path = "/" + apiIndex + "/_search";
        try {
            String jsonBody = objectMapper.writeValueAsString(body);
            String responseBody = restClient.post()
                    .uri(path)
                    .body(jsonBody)
                    .retrieve()
                    .body(String.class);

            Map<String, Object> map = objectMapper.readValue(responseBody, new TypeReference<>() {});
            return DatajudSearchResult.success(apiIndex, map);
        } catch (RestClientResponseException e) {
            int st = e.getStatusCode().value();
            String motivo = (st == 401 || st == 403) ? "nao_autorizado" : "http_erro";
            return DatajudSearchResult.failure(motivo, st, truncate(e.getResponseBodyAsString(), 400));
        } catch (RestClientException e) {
            log.warn("DataJud rede: {}", e.getMessage());
            return DatajudSearchResult.failure("rede", 0, truncate(e.getMessage(), 400));
        } catch (Exception e) {
            log.warn("DataJud parse: {}", e.getMessage());
            return DatajudSearchResult.failure("parse_erro", 0, truncate(e.getMessage(), 400));
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    public int getTimeoutMs() {
        return timeoutMs;
    }
}
