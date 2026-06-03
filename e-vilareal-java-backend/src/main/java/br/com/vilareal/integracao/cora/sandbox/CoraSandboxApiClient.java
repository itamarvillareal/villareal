package br.com.vilareal.integracao.cora.sandbox;

import br.com.vilareal.integracao.cora.CoraHttpResponse;
import br.com.vilareal.integracao.cora.CoraTokenService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Chamadas HTTP de baixo nível à API Cora (stage / Integração Direta).
 */
class CoraSandboxApiClient {

    private static final Logger log = LoggerFactory.getLogger(CoraSandboxApiClient.class);

    private final CoraSandboxProperties props;
    private final CoraSandboxHttpClient httpClient;
    private final CoraTokenService tokenService;
    private final ObjectMapper objectMapper;

    CoraSandboxApiClient(
            CoraSandboxProperties props,
            CoraSandboxHttpClient httpClient,
            CoraTokenService tokenService,
            ObjectMapper objectMapper) {
        this.props = props;
        this.httpClient = httpClient;
        this.tokenService = tokenService;
        this.objectMapper = objectMapper;
    }

    CoraHttpResponse emitirBoleto(String idempotencyKey, String jsonBody) {
        String url = mtlsBase() + "/v2/invoices";
        Map<String, String> headers = new HashMap<>(tokenService.authHeaders());
        return httpClient.postJson(url, headers, jsonBody, idempotencyKey);
    }

    CoraHttpResponse consultarBoleto(String invoiceId) {
        String url = mtlsBase() + "/v2/invoices/" + invoiceId;
        return httpClient.get(url, tokenService.authHeaders());
    }

    CoraHttpResponse consultarExtrato(LocalDate start, LocalDate end) {
        String url = apiBase()
                + "/bank-statement/statement?start="
                + start
                + "&end="
                + end;
        return httpClient.get(url, tokenService.authHeaders());
    }

    CoraHttpResponse iniciarPagamento(String idempotencyKey, String jsonBody) {
        String url = apiBase() + "/payments/initiate";
        Map<String, String> headers = new HashMap<>(tokenService.authHeaders());
        return httpClient.postJson(url, headers, jsonBody, idempotencyKey);
    }

    /**
     * Lista pagamentos iniciados (filtro por status/data).
     * Doc: GET /payments?status=INITIATED&start=&end=
     */
    CoraHttpResponse listarPagamentos(String status, LocalDate start, LocalDate end) {
        String url = apiBase()
                + "/payments?status="
                + status
                + "&start="
                + start
                + "&end="
                + end
                + "&page=0&size=50";
        return httpClient.get(url, tokenService.authHeaders());
    }

    String buildBoletoTesteJson(String code) throws Exception {
        LocalDate dueDate = LocalDate.now().plusDays(7);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", code);
        body.put("customer", Map.of(
                "name", "Cliente Teste Sandbox VilaReal",
                "email", "sandbox@vilareal.test",
                "document", Map.of("identity", "34052649000178", "type", "CNPJ"),
                "address", Map.of(
                        "street", "Rua Teste",
                        "number", "100",
                        "district", "Centro",
                        "city", "Goiania",
                        "state", "GO",
                        "complement", "N/A",
                        "zip_code", "74000000")));
        body.put(
                "services",
                java.util.List.of(Map.of(
                        "name", "Servico teste harness",
                        "description", "Laboratorio Cora sandbox",
                        "amount", 1000)));
        body.put(
                "payment_terms",
                Map.of(
                        "due_date", dueDate.toString(),
                        "fine", Map.of("amount", 0),
                        "interest", Map.of("rate", 0.0),
                        "discount", Map.of("type", "PERCENT", "value", 0.0)));
        return objectMapper.writeValueAsString(body);
    }

    String buildIniciarPagamentoJson(String digitableLine, LocalDate scheduledAt) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", "sandbox-" + UUID.randomUUID());
        body.put("digitable_line", digitableLine.replaceAll("\\D", ""));
        if (scheduledAt != null) {
            body.put("scheduled_at", scheduledAt.toString());
        }
        return objectMapper.writeValueAsString(body);
    }

    void logExtratoItens(CoraHttpResponse response) {
        if (!response.isSuccess()) {
            log.warn("[CoraSandbox] Extrato HTTP {}: {}", response.statusCode(), response.body());
            return;
        }
        try {
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode entries = root.path("entries");
            if (entries.isMissingNode()) {
                entries = root.path("content");
            }
            if (!entries.isArray()) {
                log.info("[CoraSandbox] Extrato (corpo): {}", truncate(response.body(), 2000));
                return;
            }
            log.info("[CoraSandbox] Extrato: {} item(ns)", entries.size());
            for (JsonNode item : entries) {
                log.info(
                        "[CoraSandbox]   extrato id={} type={} amount={} description={} status={}",
                        text(item, "id"),
                        text(item, "type"),
                        text(item, "amount"),
                        truncate(text(item, "description"), 80),
                        text(item, "status"));
            }
        } catch (Exception e) {
            log.info("[CoraSandbox] Extrato (raw): {}", truncate(response.body(), 2000));
        }
    }

    void logBoletoResposta(CoraHttpResponse response) {
        log.info("[CoraSandbox] Boleto HTTP {} body: {}", response.statusCode(), response.body());
        if (!response.isSuccess()) {
            return;
        }
        try {
            JsonNode json = objectMapper.readTree(response.body());
            String id = firstNonEmpty(json, "id", "invoice_id");
            String status = text(json.path("status"), "code");
            if (status.isEmpty()) {
                status = text(json.path("status"), "name");
            }
            String digitable = deepText(json, "bank_slip", "digitable");
            if (digitable.isEmpty()) {
                digitable = deepText(json, "bankslip", "digitable");
            }
            log.info(
                    "[CoraSandbox] Boleto emitido: id={} status={} linha_digitavel={}",
                    id,
                    status,
                    digitable);
        } catch (Exception ignored) {
            // body já logado acima
        }
    }

    private static String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode()) {
            return "";
        }
        JsonNode v = node.path(field);
        return v.isMissingNode() || v.isNull() ? "" : v.asText("");
    }

    private static String firstNonEmpty(JsonNode json, String... fields) {
        for (String f : fields) {
            String v = text(json, f);
            if (!v.isEmpty()) {
                return v;
            }
        }
        return "";
    }

    private static String deepText(JsonNode json, String obj, String field) {
        return text(json.path(obj), field);
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }

    private String apiBase() {
        return stripTrailingSlash(props.getBaseUrl());
    }

    private String mtlsBase() {
        return stripTrailingSlash(props.getMtlsBaseUrl());
    }

    private static String stripTrailingSlash(String url) {
        return url != null && url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
