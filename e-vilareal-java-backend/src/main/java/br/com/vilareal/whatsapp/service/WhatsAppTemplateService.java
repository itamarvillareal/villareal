package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.dto.CreateTemplateRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateDTO;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class WhatsAppTemplateService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppTemplateService.class);
    private static final Pattern PARAM_PATTERN = Pattern.compile("\\{\\{(\\d+)\\}\\}");
    private static final Pattern NAME_PATTERN = Pattern.compile("^[a-z0-9_]+$");
    public static final String TEMPLATE_ANIVERSARIO = "felicitacao_aniversario";
    private static final String CORPO_TEMPLATE_ANIVERSARIO =
            "Olá {{1}}! 🎂 O escritório Villa Real Advocacia deseja a você um Feliz Aniversário! Que este novo ano seja repleto de conquistas e alegrias. Um grande abraço de toda a equipe! Dr. Itamar e Villa Real Advocacia.";

    private final WhatsAppConfig whatsAppConfig;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public WhatsAppTemplateService(
            WhatsAppConfig whatsAppConfig, RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.whatsAppConfig = whatsAppConfig;
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));

        this.restClient = restClientBuilder
                .baseUrl(whatsAppConfig.getApiUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + whatsAppConfig.getAccessToken())
                .requestFactory(requestFactory)
                .build();
    }

    public List<WhatsAppTemplateDTO> listarTemplates() {
        validarConfiguracao();

        List<WhatsAppTemplateDTO> templates = new ArrayList<>();
        String after = null;

        do {
            String uri = UriComponentsBuilder.fromPath("/{wabaId}/message_templates")
                    .queryParam("limit", 100)
                    .queryParamIfPresent("after", java.util.Optional.ofNullable(after))
                    .build(whatsAppConfig.getWabaId())
                    .toString();

            JsonNode response = getJson(uri);
            JsonNode data = response.path("data");
            if (!data.isArray() || data.isEmpty()) {
                break;
            }
            for (JsonNode item : data) {
                templates.add(toDto(item));
            }

            JsonNode next = response.path("paging").path("next");
            if (!next.isTextual() || !StringUtils.hasText(next.asText())) {
                break;
            }
            JsonNode cursorAfter = response.path("paging").path("cursors").path("after");
            after = cursorAfter.isTextual() && StringUtils.hasText(cursorAfter.asText()) ? cursorAfter.asText() : null;
        } while (after != null);

        return templates;
    }

    /**
     * Garante que o template de felicitação de aniversário existe na Meta (cria se ausente).
     */
    public void garantirTemplateAniversario() {
        try {
            validarConfiguracao();
        } catch (IllegalStateException e) {
            log.warn("WhatsApp aniversário: integração não configurada — template não verificado");
            return;
        }

        try {
            String uri = UriComponentsBuilder.fromPath("/{wabaId}/message_templates")
                    .queryParam("name", TEMPLATE_ANIVERSARIO)
                    .build(whatsAppConfig.getWabaId())
                    .toString();
            JsonNode response = getJson(uri);
            JsonNode data = response.path("data");
            if (data.isArray() && !data.isEmpty()) {
                String status = textOrNull(data.get(0).get("status"));
                log.info(
                        "Template {} já existe (status: {})",
                        TEMPLATE_ANIVERSARIO,
                        status != null ? status : "desconhecido");
                return;
            }

            CreateTemplateRequest request = new CreateTemplateRequest(
                    TEMPLATE_ANIVERSARIO,
                    "UTILITY",
                    CORPO_TEMPLATE_ANIVERSARIO,
                    List.of("João Silva"));
            WhatsAppTemplateDTO created = criarTemplate(request);
            log.info(
                    "Template {} criado (status: {})",
                    TEMPLATE_ANIVERSARIO,
                    created.status() != null ? created.status() : "PENDING");
        } catch (WhatsAppApiException e) {
            log.error("Falha ao garantir template {}: {}", TEMPLATE_ANIVERSARIO, e.getMessage());
        } catch (Exception e) {
            log.error("Erro inesperado ao garantir template {}: {}", TEMPLATE_ANIVERSARIO, e.getMessage(), e);
        }
    }

    public WhatsAppTemplateDTO criarTemplate(CreateTemplateRequest request) {
        validarConfiguracao();
        validarNomeTemplate(request.name());

        String bodyText = request.bodyText().trim();
        int parameterCount = contarParametros(bodyText);
        List<String> examples = request.exampleValues() != null ? request.exampleValues() : List.of();
        if (examples.size() != parameterCount) {
            throw new IllegalArgumentException(
                    "Quantidade de valores de exemplo (" + examples.size() + ") não corresponde aos parâmetros ("
                            + parameterCount + ")");
        }

        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("name", request.name().trim());
        payload.put("language", "pt_BR");
        payload.put("category", request.category().trim().toUpperCase(Locale.ROOT));

        ObjectNode bodyComponent = objectMapper.createObjectNode();
        bodyComponent.put("type", "BODY");
        bodyComponent.put("text", bodyText);

        if (parameterCount > 0) {
            ArrayNode exampleRow = objectMapper.createArrayNode();
            for (String example : examples) {
                exampleRow.add(example != null ? example.trim() : "");
            }
            ObjectNode example = objectMapper.createObjectNode();
            ArrayNode bodyTextExamples = objectMapper.createArrayNode();
            bodyTextExamples.add(exampleRow);
            example.set("body_text", bodyTextExamples);
            bodyComponent.set("example", example);
        }

        ArrayNode components = objectMapper.createArrayNode();
        components.add(bodyComponent);
        payload.set("components", components);

        JsonNode response = postJson("/{wabaId}/message_templates", whatsAppConfig.getWabaId(), payload);
        return toDto(response);
    }

    public void deletarTemplate(String templateName) {
        validarConfiguracao();
        if (!StringUtils.hasText(templateName)) {
            throw new IllegalArgumentException("Nome do template é obrigatório");
        }

        String uri = UriComponentsBuilder.fromPath("/{wabaId}/message_templates")
                .queryParam("name", templateName.trim())
                .build(whatsAppConfig.getWabaId())
                .toString();

        try {
            restClient
                    .delete()
                    .uri(uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Template WhatsApp deletado: {}", templateName);
        } catch (RestClientResponseException e) {
            throw traduzirErroHttp(e);
        } catch (Exception e) {
            log.error("Falha ao deletar template WhatsApp {}: {}", templateName, e.getMessage());
            throw new WhatsAppApiException(
                    "Falha ao deletar template: " + e.getMessage(), 0, null, 0, e);
        }
    }

    private void validarConfiguracao() {
        if (!StringUtils.hasText(whatsAppConfig.getWabaId())
                || !StringUtils.hasText(whatsAppConfig.getAccessToken())) {
            throw new IllegalStateException("Integração WhatsApp não configurada (WABA ID ou token ausente)");
        }
    }

    private static void validarNomeTemplate(String name) {
        if (!StringUtils.hasText(name)) {
            throw new IllegalArgumentException("Nome do template é obrigatório");
        }
        String trimmed = name.trim();
        if (!NAME_PATTERN.matcher(trimmed).matches()) {
            throw new IllegalArgumentException(
                    "Nome inválido: use apenas letras minúsculas, números e underscore (ex: aviso_pagamento)");
        }
    }

    static int contarParametros(String bodyText) {
        if (!StringUtils.hasText(bodyText)) {
            return 0;
        }
        Set<Integer> indices = new LinkedHashSet<>();
        Matcher matcher = PARAM_PATTERN.matcher(bodyText);
        while (matcher.find()) {
            indices.add(Integer.parseInt(matcher.group(1)));
        }
        return indices.size();
    }

    private WhatsAppTemplateDTO toDto(JsonNode node) {
        String bodyText = extrairBodyText(node.path("components"));
        List<String> exampleValues = extrairExampleValues(node.path("components"));
        int parameterCount = contarParametros(bodyText);
        if (parameterCount == 0 && !exampleValues.isEmpty()) {
            parameterCount = exampleValues.size();
        }

        return new WhatsAppTemplateDTO(
                textOrNull(node.get("id")),
                textOrNull(node.get("name")),
                textOrNull(node.get("status")),
                textOrNull(node.get("category")),
                textOrNull(node.get("language")),
                bodyText,
                exampleValues,
                parameterCount);
    }

    private static String extrairBodyText(JsonNode components) {
        if (!components.isArray()) {
            return null;
        }
        for (JsonNode component : components) {
            if ("BODY".equalsIgnoreCase(textOrNull(component.get("type")))) {
                return textOrNull(component.get("text"));
            }
        }
        return null;
    }

    private static List<String> extrairExampleValues(JsonNode components) {
        List<String> values = new ArrayList<>();
        if (!components.isArray()) {
            return values;
        }
        for (JsonNode component : components) {
            if (!"BODY".equalsIgnoreCase(textOrNull(component.get("type")))) {
                continue;
            }
            JsonNode bodyTextExamples = component.path("example").path("body_text");
            if (bodyTextExamples.isArray() && !bodyTextExamples.isEmpty()) {
                JsonNode firstRow = bodyTextExamples.get(0);
                if (firstRow.isArray()) {
                    for (JsonNode value : firstRow) {
                        values.add(value.asText(""));
                    }
                }
            }
            break;
        }
        return values;
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isNull() || !node.isValueNode()) {
            return null;
        }
        String text = node.asText("").trim();
        return text.isEmpty() ? null : text;
    }

    private JsonNode getJson(String uri) {
        try {
            String body = restClient
                    .get()
                    .uri(uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(String.class);
            return objectMapper.readTree(body != null ? body : "{}");
        } catch (RestClientResponseException e) {
            throw traduzirErroHttp(e);
        } catch (WhatsAppApiException e) {
            throw e;
        } catch (Exception e) {
            throw new WhatsAppApiException(
                    "Falha ao consultar templates WhatsApp: " + e.getMessage(), 0, null, 0, e);
        }
    }

    private JsonNode postJson(String uriTemplate, Object uriVar, ObjectNode payload) {
        try {
            String body = restClient
                    .post()
                    .uri(uriTemplate, uriVar)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(payload.toString())
                    .retrieve()
                    .body(String.class);
            return objectMapper.readTree(body != null ? body : "{}");
        } catch (RestClientResponseException e) {
            throw traduzirErroHttp(e);
        } catch (WhatsAppApiException e) {
            throw e;
        } catch (Exception e) {
            throw new WhatsAppApiException(
                    "Falha ao criar template WhatsApp: " + e.getMessage(), 0, null, 0, e);
        }
    }

    private WhatsAppApiException traduzirErroHttp(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        String message = "Erro na API WhatsApp (HTTP " + status + ")";
        String errorType = null;
        int metaErrorCode = 0;

        try {
            JsonNode errorJson = objectMapper.readTree(e.getResponseBodyAsString());
            JsonNode error = errorJson.path("error");
            if (error.isObject()) {
                if (error.hasNonNull("message")) {
                    message = error.get("message").asText(message);
                }
                if (error.hasNonNull("type")) {
                    errorType = error.get("type").asText();
                }
                if (error.hasNonNull("code")) {
                    metaErrorCode = error.get("code").asInt(0);
                }
            }
        } catch (Exception parseError) {
            log.debug("Não foi possível parsear erro da Meta: {}", parseError.getMessage());
            if (StringUtils.hasText(e.getResponseBodyAsString())) {
                message = e.getResponseBodyAsString();
            }
        }

        log.warn("Erro WhatsApp templates HTTP {}: {}", status, message);
        return new WhatsAppApiException(message, status, errorType, metaErrorCode, e);
    }
}
