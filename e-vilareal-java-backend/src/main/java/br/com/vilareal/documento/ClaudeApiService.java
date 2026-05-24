package br.com.vilareal.documento;

import br.com.vilareal.common.exception.BusinessRuleException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ClaudeApiService {

    private static final Logger log = LoggerFactory.getLogger(ClaudeApiService.class);

    private final String apiKey;
    private final String apiUrl;
    private final String model;
    private final int maxTokens;
    private final int maxRetries;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public ClaudeApiService(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${anthropic.api.key}") String apiKey,
            @Value("${anthropic.api.url}") String apiUrl,
            @Value("${anthropic.api.model}") String model,
            @Value("${anthropic.api.max-tokens}") int maxTokens,
            @Value("${anthropic.api.timeout-seconds:30}") int timeoutSeconds,
            @Value("${anthropic.api.max-retries:3}") int maxRetries) {
        this.apiKey = apiKey;
        this.apiUrl = apiUrl;
        this.model = model;
        this.maxTokens = maxTokens;
        this.maxRetries = maxRetries;
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));

        this.restClient = restClientBuilder
                .requestFactory(requestFactory)
                .build();
    }

    public String enviarMensagem(String systemPrompt, String userMessage) {
        return enviarMensagem(systemPrompt, userMessage, null, null);
    }

    public String enviarMensagem(String systemPrompt, String userMessage, Integer maxTokensOverride, Double temperature) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessRuleException(
                    "API key da Anthropic não configurada. Defina a variável ANTHROPIC_API_KEY.");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("max_tokens", maxTokensOverride != null ? maxTokensOverride : maxTokens);
        if (temperature != null) {
            body.put("temperature", temperature);
        }
        body.put("system", systemPrompt);
        body.put("messages", List.of(Map.of("role", "user", "content", userMessage)));

        int attempt = 0;
        while (true) {
            attempt++;
            try {
                String responseBody = restClient.post()
                        .uri(apiUrl)
                        .header("x-api-key", apiKey)
                        .header("anthropic-version", "2023-06-01")
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON)
                        .body(body)
                        .exchange((request, response) -> {
                            try (InputStream in = response.getBody()) {
                                if (in == null) {
                                    return null;
                                }
                                return new String(in.readAllBytes(), StandardCharsets.UTF_8);
                            }
                        });

                return extrairTextoResposta(responseBody);
            } catch (RestClientResponseException e) {
                if (e.getStatusCode().value() == 429 && attempt < maxRetries) {
                    long backoffMs = (long) Math.pow(2, attempt - 1) * 1000L;
                    log.warn("Rate limit Anthropic (tentativa {}/{}). Aguardando {}ms.", attempt, maxRetries, backoffMs);
                    dormir(backoffMs);
                    continue;
                }
                throw traduzirErroHttp(e);
            } catch (BusinessRuleException e) {
                throw e;
            } catch (Exception e) {
                throw new BusinessRuleException("Falha ao comunicar com a Claude API: " + e.getMessage());
            }
        }
    }

    private String extrairTextoResposta(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            throw new BusinessRuleException("Resposta vazia da Claude API.");
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode error = root.path("error");
            if (!error.isMissingNode() && !error.isNull()) {
                String msg = error.path("message").asText("erro desconhecido");
                throw new BusinessRuleException("Erro da Claude API: " + msg);
            }
            JsonNode content = root.path("content");
            if (!content.isArray() || content.isEmpty()) {
                throw new BusinessRuleException("Resposta da Claude API sem conteúdo textual.");
            }
            for (JsonNode block : content) {
                if ("text".equals(block.path("type").asText())) {
                    String text = block.path("text").asText(null);
                    if (text != null && !text.isBlank()) {
                        return text;
                    }
                }
            }
            throw new BusinessRuleException("Resposta da Claude API sem bloco de texto.");
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessRuleException("Falha ao interpretar resposta da Claude API: " + e.getMessage());
        }
    }

    private BusinessRuleException traduzirErroHttp(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        String detalhe = extrairMensagemErro(e.getResponseBodyAsString());
        return switch (status) {
            case 401 -> new BusinessRuleException("API key da Anthropic inválida ou ausente.");
            case 429 -> new BusinessRuleException("Limite de requisições da Claude API excedido. Tente novamente em instantes.");
            case 529 -> new BusinessRuleException("Claude API temporariamente sobrecarregada. Tente novamente.");
            default -> new BusinessRuleException(
                    "Erro na Claude API (HTTP " + status + "): " + detalhe);
        };
    }

    private String extrairMensagemErro(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return "sem detalhes";
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode msg = root.path("error").path("message");
            if (!msg.isMissingNode() && !msg.asText().isBlank()) {
                return msg.asText();
            }
        } catch (Exception ignored) {
            // usa corpo bruto abaixo
        }
        return responseBody.length() > 200 ? responseBody.substring(0, 200) + "..." : responseBody;
    }

    private static void dormir(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessRuleException("Chamada à Claude API interrompida.");
        }
    }
}
