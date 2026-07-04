package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.dto.WhatsAppErrorResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaUploadResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.file.Path;
import java.time.Duration;

/**
 * Upload de mídia outbound para a Meta ({@code POST /{phone-number-id}/media}).
 */
@Service
public class WhatsAppMediaUploadService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppMediaUploadService.class);

    private final WhatsAppConfig whatsAppConfig;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public WhatsAppMediaUploadService(
            WhatsAppConfig whatsAppConfig, RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.whatsAppConfig = whatsAppConfig;
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(120));

        this.restClient = restClientBuilder
                .baseUrl(whatsAppConfig.getApiUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + whatsAppConfig.getAccessToken())
                .requestFactory(requestFactory)
                .build();
    }

    /**
     * Envia arquivo para a Meta e retorna o {@code media_id}.
     *
     * @param filePath caminho do arquivo (lido via stream, sem carregar tudo na RAM)
     * @param filename nome original para o part multipart
     * @param mime     MIME completo (ex.: image/jpeg) — campo {@code type} do upload Meta
     */
    public String uploadParaMeta(Path filePath, String filename, String mime, long sizeBytes) {
        if (filePath == null || !filePath.toFile().isFile()) {
            throw new IllegalArgumentException("Arquivo de mídia inválido.");
        }
        String safeFilename = StringUtils.hasText(filename) ? filename : filePath.getFileName().toString();
        String safeMime = StringUtils.hasText(mime) ? mime : MediaType.APPLICATION_OCTET_STREAM_VALUE;

        log.info(
                "Upload de mídia WhatsApp para Meta: mime={}, tamanho={} bytes, arquivo={}",
                safeMime,
                sizeBytes,
                safeFilename);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("messaging_product", "whatsapp");
        body.add("type", safeMime);
        body.add("file", fileResource(filePath, safeFilename));

        try {
            WhatsAppMediaUploadResponse response = restClient
                    .post()
                    .uri("/{phoneNumberId}/media", whatsAppConfig.getPhoneNumberId())
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(WhatsAppMediaUploadResponse.class);

            if (response == null || !StringUtils.hasText(response.id())) {
                throw new WhatsAppApiException("Resposta vazia ou sem media_id da WhatsApp API.", 0, null, 0);
            }

            log.info("Upload Meta concluído. media_id={}", response.id());
            return response.id();
        } catch (RestClientResponseException e) {
            throw traduzirErroHttp(e, safeMime, sizeBytes);
        } catch (WhatsAppApiException e) {
            throw e;
        } catch (Exception e) {
            log.error(
                    "Falha de conexão no upload de mídia WhatsApp (mime={}, tamanho={}): {}",
                    safeMime,
                    sizeBytes,
                    e.getMessage());
            throw new WhatsAppApiException(
                    "Falha de conexão no upload de mídia WhatsApp: " + e.getMessage(), 0, null, 0, e);
        }
    }

    private static FileSystemResource fileResource(Path filePath, String filename) {
        return new FileSystemResource(filePath) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
    }

    private WhatsAppApiException traduzirErroHttp(
            RestClientResponseException e, String mime, long sizeBytes) {
        int status = e.getStatusCode().value();
        String errorType = null;
        int metaErrorCode = 0;
        String message = "Erro ao enviar mídia para WhatsApp.";

        try {
            WhatsAppErrorResponse errorResponse =
                    objectMapper.readValue(e.getResponseBodyAsString(), WhatsAppErrorResponse.class);
            if (errorResponse.error() != null) {
                WhatsAppErrorResponse.ErrorDetail detail = errorResponse.error();
                errorType = detail.type();
                metaErrorCode = detail.code() != null ? detail.code() : 0;
                message = detail.message() != null ? detail.message() : message;
            }
        } catch (Exception parseError) {
            log.debug("Não foi possível deserializar erro da WhatsApp API: {}", parseError.getMessage());
            if (e.getResponseBodyAsString() != null && !e.getResponseBodyAsString().isBlank()) {
                message = e.getResponseBodyAsString();
            }
        }

        log.error(
                "Erro no upload de mídia WhatsApp. HTTP {}, Meta error: {} - {} (mime={}, tamanho={})",
                status,
                metaErrorCode,
                message,
                mime,
                sizeBytes);
        return new WhatsAppApiException(message, status, errorType, metaErrorCode, e);
    }
}
